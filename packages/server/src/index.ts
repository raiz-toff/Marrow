import { existsSync, readFileSync, readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import { toJsonReport, type Diagnostic } from '@marrow/diagnostics';
import type { IconCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import {
  buildSingleFile,
  createSiteBuilder,
  planSite,
  type Brand,
  type ThemeConfig,
  type BuildResult,
  type SiteBuilder,
  type SiteCache,
} from '@marrow/site';
import { LIVE_CLIENT } from './inject.js';

export { LIVE_CLIENT } from './inject.js';

/**
 * The Marrow dev server — the agent's build loop made live. The agent edits
 * YAML; the user's browser updates by itself. Hand-rolled on node:http +
 * fs.watch + SSE; binds 127.0.0.1.
 *
 * Serves exactly what `marrow build` would ship: small topologies as one
 * page, large ones as the full multi-page site (zone pages, device pages,
 * inventory, cross-page search). Site pages are built lazily on request and
 * memoized on a content hash, so an edit relayouts only the pages it feeds.
 *
 * API (all JSON): GET /api/status · GET /api/validate · GET /api/scene ·
 * GET /api/files · GET/POST /api/current · GET /api/events (SSE)
 */

export interface ServeOptions {
  /** A .yaml file or a directory of them. */
  input: string;
  icons: IconCatalog;
  port?: number;
  host?: string;
  /** When false or undefined, automatically increments port on EADDRINUSE up to 10 attempts. When true, fails fast. */
  portExplicit?: boolean;
  /** Global branding from brand/brand.html, applied to every previewed page. */
  brand?: Brand;
  themeConfig?: ThemeConfig;
  /** Optional config file to watch for real-time brand & theme reloading. */
  configFile?: string;
  layout?: { density?: 'compact' | 'standard' | 'spacious'; scale?: number };
  /** Dynamic loader called on config file changes to reload brand & theme without server restarts. */
  configLoader?: () => {
    brand?: Brand;
    themeConfig?: ThemeConfig;
    layout?: { density?: 'compact' | 'standard' | 'spacious'; scale?: number };
  };
}

export interface RunningServer {
  port: number;
  url: string;
  currentFile: () => string;
  /** 'single' (one self-contained page) or 'site' (multi-page folder site). */
  mode: () => 'single' | 'site';
  close: () => Promise<void>;
}

interface State {
  dir: string;
  current: string; // absolute path of the current yaml
  stamp: number;
  diagnostics: Diagnostic[];
  valid: boolean;
  mode: 'single' | 'site';
  brand?: Brand;
  themeConfig?: ThemeConfig;
  layout?: { density?: 'compact' | 'standard' | 'spacious'; scale?: number };
  /** single mode */
  build?: BuildResult;
  lastGoodHtml?: string;
  /** site mode */
  builder?: SiteBuilder;
  /** memoized pages, kept across rebuilds — the incremental heart */
  cache: SiteCache;
  /** how many pages the last valid rebuild invalidated */
  lastChanged: number;
  /** wall-clock ms of the last rebuild (validate + plan + eager index page) */
  lastRebuildMs: number;
  building: Promise<unknown>;
}

export async function serve(options: ServeOptions): Promise<RunningServer> {
  const inputPath = resolve(options.input);
  if (!existsSync(inputPath)) throw new Error(`input not found: ${inputPath}`);
  const isDir = statSync(inputPath).isDirectory();
  const dir = isDir ? inputPath : dirname(inputPath);
  const first = isDir ? listYaml(dir)[0] : basename(inputPath);
  if (!first) throw new Error(`no .yaml files in ${dir}`);

  const state: State = {
    dir,
    current: join(dir, first),
    stamp: 0,
    diagnostics: [],
    valid: false,
    mode: 'single',
    brand: options.brand,
    themeConfig: options.themeConfig,
    layout: options.layout,
    cache: new Map(),
    lastChanged: 0,
    lastRebuildMs: 0,
    building: Promise.resolve(),
  };

  const sseClients = new Set<ServerResponse>();
  const notify = (event: string, data: string): void => {
    const payload = `event: ${event}\ndata: ${data.replace(/\n/g, '\ndata: ')}\n\n`;
    for (const res of sseClients) res.write(payload);
  };

  /** All builds (rebuilds AND lazy page builds) run through one queue —
   *  layout never runs concurrently, and pages never race a rebuild. */
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = state.building.then(fn);
    state.building = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const rebuild = (): Promise<void> =>
    enqueue(async () => {
      const started = performance.now();
      if (options.configLoader) {
        const dynamicCfg = options.configLoader();
        state.brand = dynamicCfg.brand;
        state.themeConfig = dynamicCfg.themeConfig;
        state.layout = dynamicCfg.layout;
      }
      let source: string;
      try {
        source = readFileSync(state.current, 'utf8');
      } catch (err) {
        state.valid = false;
        state.diagnostics = [];
        notify('invalid', `cannot read ${basename(state.current)}: ${(err as Error).message}`);
        return;
      }
      const result = validateSource(source, { icons: options.icons });
      state.diagnostics = result.diagnostics;
      state.valid = result.valid;
      if (!result.topology) {
        notify(
          'invalid',
          result.diagnostics
            .filter((d) => d.severity === 'error')
            .map((d) => `${d.code} ${d.path}${d.loc ? `:${d.loc.line}` : ''} — ${d.message}`)
            .join('\n'),
        );
        return;
      }

      if (state.layout?.density && !result.topology.density) {
        result.topology.density = state.layout.density;
      }
      if (state.layout?.scale !== undefined && result.topology.scale === undefined) {
        result.topology.scale = state.layout.scale;
      }

      const prevShape = state.mode === 'site' ? state.builder?.shapeHash : 'single';
      const plan = planSite(result.topology);
      try {
        if (plan.mode === 'single') {
          const built = await buildSingleFile(result.topology, {
            icons: options.icons,
            ...(state.brand !== undefined ? { brand: state.brand } : {}),
            ...(state.themeConfig !== undefined ? { themeConfig: state.themeConfig } : {}),
          });
          state.mode = 'single';
          state.build = built;
          state.builder = undefined;
          state.lastGoodHtml = injectLive(built.html);
          state.lastChanged = 1;
        } else {
          const builder = createSiteBuilder(
            result.topology,
            {
              icons: options.icons,
              ...(state.brand !== undefined ? { brand: state.brand } : {}),
              ...(state.themeConfig !== undefined ? { themeConfig: state.themeConfig } : {}),
            },
            state.cache,
          );
          const changed = builder.changedPages();
          for (const key of state.cache.keys()) if (!builder.has(key)) state.cache.delete(key);
          state.mode = 'site';
          state.builder = builder;
          state.build = undefined;
          state.lastChanged = changed.length;
          // warm the page most likely to be open (memoized no-op when fresh);
          // the rest build on request
          await builder.buildPage('index.html');
          state.lastRebuildMs = Math.round(performance.now() - started);
          state.stamp++;
          notify('valid', 'ok');
          const shapeChanged = prevShape !== builder.shapeHash;
          notify('reload', JSON.stringify({ stamp: state.stamp, pages: shapeChanged ? null : changed }));
          return;
        }
      } catch (err) {
        state.valid = false;
        notify('invalid', (err as Error).message);
        return;
      }
      state.lastRebuildMs = Math.round(performance.now() - started);
      state.stamp++;
      notify('valid', 'ok');
      notify('reload', JSON.stringify({ stamp: state.stamp, pages: null }));
    });

  // watch the directory; debounce per-file bursts from fs.watch
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const watcher: FSWatcher = watch(state.dir, { recursive: true }, (_event, filename) => {
    if (!filename || !/\.ya?ml$/i.test(filename)) return;
    const full = join(state.dir, filename);
    clearTimeout(timers.get(full));
    timers.set(
      full,
      setTimeout(() => {
        timers.delete(full);
        if (full === state.current) void rebuild();
        else notify('files', filename);
      }, 90),
    );
  });

  let configWatcher: FSWatcher | undefined;
  if (options.configFile) {
    const configPath = resolve(options.configFile);
    if (existsSync(configPath)) {
      configWatcher = watch(configPath, () => {
        clearTimeout(timers.get(configPath));
        timers.set(
          configPath,
          setTimeout(() => {
            timers.delete(configPath);
            state.cache.clear();
            void rebuild();
          }, 90),
        );
      });
    }
  }

  const server: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const send = (code: number, body: string, type = 'application/json'): void => {
        res.writeHead(code, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' });
        res.end(body);
      };

      if (url.pathname === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.write(': connected\n\n');
        sseClients.add(res);
        const heartbeat = setInterval(() => {
          if (!res.writableEnded) res.write(': heartbeat\n\n');
        }, 15000);
        req.on('close', () => {
          clearInterval(heartbeat);
          sseClients.delete(res);
        });
        return;
      }

      if (url.pathname === '/api/status') {
        const report = toJsonReport(state.diagnostics, basename(state.current));
        send(
          200,
          JSON.stringify({
            file: basename(state.current),
            stamp: state.stamp,
            valid: state.valid,
            errors: report.summary.errors,
            warnings: report.summary.warnings,
            mode: state.mode,
            pages: state.mode === 'site' ? (state.builder?.plan.zonePages.length ?? 0) + 2 + (state.builder?.plan.devicePages.length ?? 0) : 1,
            changed: state.lastChanged,
            rebuildMs: state.lastRebuildMs,
          }),
        );
        return;
      }

      if (url.pathname === '/api/validate') {
        send(200, JSON.stringify(toJsonReport(state.diagnostics, basename(state.current)), null, 2));
        return;
      }

      if (url.pathname === '/api/scene') {
        if (state.mode === 'site' && state.builder) {
          const entry = await enqueue(() => state.builder!.buildPage('index.html')).catch(() => undefined);
          if (entry?.scene) return send(200, JSON.stringify(entry.scene));
          return send(404, JSON.stringify({ error: 'no successful build yet' }));
        }
        if (!state.build) return send(404, JSON.stringify({ error: 'no successful build yet' }));
        send(200, JSON.stringify(state.build.scene));
        return;
      }

      if (url.pathname === '/api/files') {
        send(200, JSON.stringify({ files: listYaml(state.dir), current: basename(state.current) }));
        return;
      }

      if (url.pathname === '/api/current') {
        if (req.method === 'POST') {
          const body = await readBody(req);
          let requested: string | undefined;
          try {
            requested = (JSON.parse(body) as { file?: string }).file;
          } catch {
            return send(400, JSON.stringify({ error: 'body must be JSON: {"file": "name.yaml"}' }));
          }
          const switched = switchTo(requested);
          if (!switched.ok) return send(404, JSON.stringify({ error: switched.error }));
          await rebuild();
          return send(200, JSON.stringify({ ok: true, current: basename(state.current) }));
        }
        send(200, JSON.stringify({ current: basename(state.current) }));
        return;
      }

      if (url.pathname.startsWith('/api/')) return send(404, JSON.stringify({ error: 'not found' }));

      // ── page + asset routes ─────────────────────────────────────────────
      const requested = url.searchParams.get('file');
      if (requested !== null) {
        const switched = switchTo(requested);
        if (!switched.ok) return send(404, switched.error, 'text/plain');
        await rebuild();
      }

      const path = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
      if (path.split('/').includes('..')) return send(404, JSON.stringify({ error: 'not found' }));

      if (state.mode === 'site' && state.builder) {
        const builder = state.builder;
        if (!builder.has(path)) {
          // pages can disappear across rebuilds (zone renamed/removed) — recover at the overview
          if (path.endsWith('.html')) {
            res.writeHead(302, { Location: '/' });
            res.end();
            return;
          }
          return send(404, JSON.stringify({ error: 'not found' }));
        }
        try {
          const entry = await enqueue(() => builder.buildPage(path));
          if (!entry) return send(404, JSON.stringify({ error: 'not found' }));
          if (path.endsWith('.html')) return send(200, injectLive(entry.content), 'text/html');
          return send(200, entry.content, contentType(path));
        } catch (err) {
          return send(200, errorPage(basename(state.current), state.diagnostics, (err as Error).message), 'text/html');
        }
      }

      // single mode
      if (path === 'index.html') {
        if (!state.lastGoodHtml) await rebuild();
        if (state.lastGoodHtml) return send(200, state.lastGoodHtml, 'text/html');
        return send(200, errorPage(basename(state.current), state.diagnostics), 'text/html');
      }
      if (path.endsWith('.html')) {
        res.writeHead(302, { Location: '/' });
        res.end();
        return;
      }
      send(404, JSON.stringify({ error: 'not found' }));
    })().catch((err: unknown) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(String(err));
    });
  });

  const switchTo = (requested: string | undefined): { ok: true } | { ok: false; error: string } => {
    if (!requested) return { ok: false, error: 'missing file' };
    const name = basename(requested); // no path traversal
    const full = join(state.dir, name);
    if (!existsSync(full) || !/\.ya?ml$/i.test(name)) return { ok: false, error: `no such topology: ${name}` };
    if (full !== state.current) {
      state.current = full;
      state.build = undefined;
      state.lastGoodHtml = undefined;
      state.builder = undefined;
      state.cache.clear();
    }
    return { ok: true };
  };

  await rebuild();

  const host = options.host ?? '127.0.0.1';
  const basePort = options.port ?? 5200;
  const maxAttempts = options.portExplicit || basePort === 0 ? 1 : 10;
  let activePort = basePort;

  await new Promise<void>((resolvePort, reject) => {
    const tryListen = (attempt: number) => {
      const p = basePort === 0 ? 0 : basePort + attempt;
      const onError = (err: NodeJS.ErrnoException) => {
        server.removeListener('listening', onListening);
        if (err.code === 'EADDRINUSE' && attempt < maxAttempts - 1) {
          console.warn(`warning: port ${p} is in use, trying ${p + 1}...`);
          tryListen(attempt + 1);
        } else {
          reject(err);
        }
      };
      const onListening = () => {
        server.removeListener('error', onError);
        const address = server.address();
        activePort = typeof address === 'object' && address !== null ? address.port : p;
        resolvePort();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(p, host);
    };
    tryListen(0);
  });
  const port = activePort;

  return {
    port,
    url: `http://${host}:${port}/`,
    currentFile: () => basename(state.current),
    mode: () => state.mode,
    close: async () => {
      watcher.close();
      configWatcher?.close();
      for (const res of sseClients) res.end();
      sseClients.clear();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}

function injectLive(html: string): string {
  const idx = html.lastIndexOf('</body>');
  if (idx === -1) return `${html}\n${LIVE_CLIENT}`;
  return `${html.slice(0, idx)}${LIVE_CLIENT}\n${html.slice(idx)}`;
}

function contentType(path: string): string {
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  return 'application/octet-stream';
}

function listYaml(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/i.test(f))
    .sort();
}

async function readBody(req: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function errorPage(file: string, diagnostics: Diagnostic[], extra?: string): string {
  const items = diagnostics
    .map(
      (d) =>
        `<li><code>${escapeHtml(d.code)}</code> ${escapeHtml(d.path)}${d.loc ? `:${d.loc.line}` : ''} — ${escapeHtml(d.message)}${
          d.hint ? `<br><em>hint: ${escapeHtml(d.hint)}</em>` : ''
        }</li>`,
    )
    .join('');
  const extraBlock = extra !== undefined ? `<pre>${escapeHtml(extra)}</pre>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(file)} — invalid</title>
<style>body{background:#0b0e14;color:#dbe2ee;font:14px/1.6 system-ui;padding:40px;max-width:760px;margin:auto}
code{color:#e5484d}em{color:#8a93a6;font-style:normal}li{margin-bottom:10px}pre{white-space:pre-wrap;color:#ffb4ab}</style></head>
<body><h2>${escapeHtml(file)} has build problems</h2>${extraBlock}<ul>${items}</ul>
<p>Fix the YAML and this page will update itself.</p>${LIVE_CLIENT}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
