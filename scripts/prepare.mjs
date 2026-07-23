// Root `prepare` hook, run automatically after `npm install`.
//
// Locally we compile the TypeScript toolchain so the CLI and tests are ready to
// run straight after install. On Vercel we skip it: the only thing deployed
// there is the docs site (docs/), which is fully self-contained — it imports no
// @marrow/* package — so a full `tsc -b` of the toolchain would just add minutes
// and fail the deploy whenever the toolchain is mid-change. The toolchain is
// still compiled and tested by its own CI workflow (which does not set VERCEL).
import { execSync } from 'node:child_process';

if (process.env.VERCEL) {
  console.log('[prepare] VERCEL detected — skipping toolchain compile (docs site needs none of it)');
  process.exit(0);
}

execSync('npm run compile', { stdio: 'inherit' });
