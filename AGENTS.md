# Marrow — Agent Operating Router

Marrow compiles declarative network topology YAML (`input/*.yaml`) into self-contained, interactive, offline HTML network diagrams.

## Operating Modes (Select Exactly One per Task)

| Mode | Trigger | Context to Load | Invariant / Boundary |
| :--- | :--- | :--- | :--- |
| **Mode 1: Network Diagrams** | Creating, importing, or editing network topologies | Load `.agents/skills/marrow-topology/SKILL.md` | Author in `input/`. Run `validate` & `snapshot`. **Do NOT read `packages/` source code.** |
| **Mode 2: Compiler Coding** | Modifying Marrow's TypeScript compiler or packages | Read `docs/content/6.contributing/3.packages.md` & `2.architecture.md` | Modify `packages/`. Run `npm test` & `compile`. **Do NOT load `marrow-topology`.** |
| **Mode 3: Writing Docs / ADRs** | Writing technical docs, ADRs, or runbooks | Load `.agents/skills/technical-documentation/SKILL.md` | Follow Diátaxis framework standards. Use Nygard format for ADRs. |

## Quick Command Reference
Run from repository root. Flags require `--` separator (e.g., `npm run validate -- input/net.yaml --json`).

```bash
npm run validate <file> [--json]       # Schema & reference verification (exit code 0 required)
npm run build <file> [--single] [-o X] # Compile standalone HTML or multi-page site
npm run dev                            # Live hot-reloading preview server (127.0.0.1:5200)
npm run snapshot <file> [-o X.png]     # Headless visual verification (Playwright Chromium)
npm run icons search <query...> [--json] # Search verified icon catalog (batch multi-query supported)
npm test                               # Run full test suite (Vitest)
npm run compile                        # Rebuild TypeScript packages and runtime bundle
```

## Skills & Updates: Verification, Authorization & Self-Healing

1. **Check for Updates**: When running, check skills and dependencies (`npx skills check`, toolchain checks).
2. **Safe vs. Impacting Updates**:
   - **Safe Updates**: Apply non-breaking patches cleanly without altering custom configuration or unrelated code.
   - **Impacting / Breaking Updates**: If an update changes schemas, alters existing diagram syntax, or affects compiler outputs, **stop and notify the user**. Detail what will be affected and obtain explicit user authorization before updating.
3. **Autonomous Self-Healing**:
   - When updates introduce minor issues (deprecated keys, renamed attributes, minor layout warnings, missing icons), the agent must **self-heal on its own**:
     - Run `npm run validate <file> --json` or `npm test` to capture exact diagnostics.
     - Automatically remediate syntax changes, update renamed keys, and recompile packages.
     - Confirm the fix with 0 errors before reporting back.
   - Escalate to the user only if the issue requires architectural design decisions or risks data loss.

## Non-Negotiable Invariants
1. **Validate Before Ready**: Zero errors on `validate` before claiming a diagram task is done.
2. **Never Guess Icons**: Query `npm run icons search <keyword>` to find valid icon IDs.
3. **Declare Meaning**: Topology structure (`tier`, `zone`, `ha_pair_with`) must be explicitly declared; layout is computed, never guessed from names.
4. **Authorize Impacting Updates**: Never silently apply breaking updates that affect topology schemas or user files without user authorization.
5. **Autonomous Self-Healing**: Automatically heal minor update regressions through the diagnostic/validation loop.
6. **Never Hand-Edit Generated Code**: Do not touch `output/`, `dist/`, or `icon-packs/**/svg/`.
7. **No Unauthorized Commits**: Never run git commit or push without explicit user request.

