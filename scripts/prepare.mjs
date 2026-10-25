// Root `prepare` hook, run automatically after `npm install`.
//
// Locally we compile the full TypeScript toolchain.
// On Vercel we compile strictly @marrow/ui which is imported by docs/,
// skipping the rest of the CLI/compiler toolchain to keep deploys fast.
import { execSync } from 'node:child_process';

if (process.env.VERCEL) {
  console.log('[prepare] VERCEL detected — compiling @marrow/ui for docs site');
  execSync('npx tsc -b packages/ui', { stdio: 'inherit' });
  process.exit(0);
}

execSync('npm run compile', { stdio: 'inherit' });
