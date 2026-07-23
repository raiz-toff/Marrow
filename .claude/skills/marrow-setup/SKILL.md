---
name: marrow-setup
description: >-
  Bring a fresh Marrow clone to a fully working state: install dependencies,
  compile the toolchain, and fetch the vendor icon packs (aws/azure/gcp) that
  are never committed to the repo. Use right after cloning, when the build is
  missing, or when validate reports "icon pack is not installed".
---

# Setting up a Marrow clone

Run these from the repo root, in order, skipping steps already done:

1. **Install + compile**
   ```
   npm install
   npm run compile
   ```

2. **Fetch the vendor icon packs.** The `aws`, `azure`, and `gcp` packs are
   NOT in the repo — vendor terms allow using the icons in diagrams but not
   redistributing the libraries, so every clone downloads them from the
   vendors' own servers (sources + license pointers: `icon-sources.json`):
   ```
   npm run icons -- fetch --yes
   ```
   Before running it, tell the user what will be downloaded and from where
   (AWS, Microsoft, and Google official icon packages, under each vendor's
   terms). `--yes` records that consent non-interactively; without it the
   command prompts. The packs land in `icon-packs/` (gitignored) and their
   search manifests are generated automatically.

3. **Verify**
   ```
   npm run icons search ec2      # should list aws/compute/amazon-ec2
   npm test                                # full suite, no network needed
   ```

## Symptoms this skill fixes

- `validate` error: `the "aws" icon pack is not installed — download it with
  marrow icons fetch aws` → run step 2 (just that pack is fine:
  `npm run marrow -- icons fetch aws --yes`).
- `npm run marrow` fails with missing `dist/` → run step 1.
- A vendor rotated its download URL and `icons fetch` can't discover it →
  update the `discover.pattern`/`urls` in `icon-sources.json` by checking the
  vendor page named in `licenseUrl`, then re-run the fetch.

## Rules

- Never commit `icon-packs/aws|azure|gcp` (they are gitignored — leave it so).
- Never vendor the icons into the repo another way (no "temporary" copies).
- Built HTML outputs embed the icons a diagram uses — sharing those is fine;
  that is the use the vendors grant.
