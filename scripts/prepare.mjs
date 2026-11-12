// `npm install` lifecycle: compile the toolchain for local work, but not on
// Vercel, where `npm run docs:build` compiles explicitly after an install that
// includes devDependencies (NODE_ENV=production would otherwise omit them).
import { execSync } from 'node:child_process';
if (process.env.VERCEL) {
  console.log('[prepare] VERCEL: skipping compile (docs:build compiles)');
} else {
  execSync('npm run compile', { stdio: 'inherit' });
}
