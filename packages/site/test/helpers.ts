import type { Topology } from '@marrow/model';
import { createSiteBuilder, type BuildOptions } from '../src/index.js';

/** Compile a topology as a Single file — the one page's html, scene and lint. */
export async function buildSingle(topology: Topology, options: BuildOptions) {
  const page = (await createSiteBuilder(topology, { ...options, shape: 'single' }).buildPage('index.html'))!;
  return { html: page.content, scene: page.scene!, lint: page.lint! };
}
