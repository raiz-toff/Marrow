# Implementation Plan - City & Campus Visual Overhaul

### Goal

Implement "Staged Animation" and "Visual Differentiators" to make City and Campus layouts distinct, premium, and "buttery."

### Assumptions

- We can inject custom canvas drawing logic into `beforeDrawing` for the background grids/rings.
- `vis.js` physics options can be dynamically swapped without forcing a hard reload.
- The `city.py` backend refactor for "Manhattan Grid" logic (from previous steps) is effective and we will build upon it.

### Plan

1.  **Frontend: Refactor Layout Update Logic**
    - **Files**: `/home/blackmagic/Documents/Production/LivePortfolio/MyPortfolio/tools/network_generator/templates/partials/scripts.html`
    - **Change**: Modify `updateLayout(mode)` to support the "Staged Animation" flow:
      - Allow Physics to warm up (Iterations 50-100) on transition.
      - Set `physics: true` for _all_ modes initially (as established in previous step), but tune the `barnesHut` solver specific to each mode.
    - **Verify**: Switch between layouts and ensure they don't "snap" instantly but drift/fly into place.

2.  **Frontend: Visual Differentiators (Backgrounds)**
    - **Files**: `/home/blackmagic/Documents/Production/LivePortfolio/MyPortfolio/tools/network_generator/templates/partials/scripts.html`
    - **Change**:
      - In `beforeDrawing`, check `this.viewMode`.
      - **If City**: Draw a faint, infinite grid (pale blue/grey) that aligns with the "blocks" from the Python backend (approx 400px cadence).
      - **If Campus**: Draw faint concentric circles (bullseye rings) centered at (0,0) to emphasize the radial nature.
      - Add a subtle "Mode Label" watermark in the corner (e.g., "CITY VIEW // SECTOR 1").
    - **Verify**: Visual inspection. Background elements should appear when switching modes.

3.  **Frontend: Premium Shape Logic Per Layout**
    - **Files**: `/home/blackmagic/Documents/Production/LivePortfolio/MyPortfolio/tools/network_generator/templates/partials/scripts.html`
    - **Change**: Update the Group rendering loop:
      - **If City**: Enforce `shape: rect` (hard corners) for groups, regardless of what YAML says, to fit the "Grid" aesthetic.
      - **If Campus/Radial**: Enforce `shape: hull` or `cloud` (organic) to fit the "Pod" aesthetic.
    - **Verify**: Check that City groups look like buildings/blocks and Campus groups look like islands.

4.  **Backend: Refine City Layout (Manhattan)**
    - **Files**: `/home/blackmagic/Documents/Production/LivePortfolio/MyPortfolio/tools/network_generator/engine/layouts/city.py`
    - **Change**: Ensure the grid logic aligns perfectly with the frontend "Street" visualizers. (e.g., ensure blocks are multiples of 400px so they fit the grid lines).
    - **Verify**: Nodes should sit _inside_ the grid cells, not on the lines.

### Risks & mitigations

- **Visual Clutter**: Background grids might make the text hard to read.
  - _Mitigation_: Use extremely low opacity (`0.05`) for background lines.
- **Performance**: Drawing infinite grids can be CPU intensive if not culled.
  - _Mitigation_: Only draw lines within the current `ctx` viewport bounds.

### Rollback plan

- Remove the `beforeDrawing` background logic.
- Revert `updateLayout` to the simple coordinate update.
