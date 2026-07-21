#!/usr/bin/env node
/**
 * Generate an icon-pack manifest from a directory of SVGs.
 * Usage: node generate-cli.js <packDir> <packName> <title> [svgSubdir]
 * The pack directory must contain the SVGs under <svgSubdir> (default "svg/").
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateManifestFromSvgDir } from './generate.js';

const [packDir, packName, title, svgSubdir = 'svg'] = process.argv.slice(2);
if (!packDir || !packName || !title) {
  console.error('usage: generate-cli <packDir> <packName> <title> [svgSubdir]');
  process.exit(2);
}

const manifest = generateManifestFromSvgDir(join(packDir, svgSubdir), {
  pack: packName,
  title,
  fileBase: svgSubdir,
});
writeFileSync(join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${manifest.icons.length} icons to ${join(packDir, 'manifest.json')}`);
