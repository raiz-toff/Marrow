# Brainstorm: Layout & Engine Improvements (Groups Separation)

## Goal

Decouple the Group processing logic from the core Network Compiler and upgrade the Layout Engine to support adaptive, organic group shapes (Convex Hulls) for non-grid layouts, fulfilling the visual promises of the Schema Guide.

## Constraints

- **Pure Python**: Must implement geometric algorithms (e.g., Convex Hull) without heavy external dependencies like `scipy` or `numpy` (only `jinja2` is currently required).
- **Backward Compatibility**: Existing YAML topologies must render correctly without modification.
- **Framework Agnostic**: The engine generates data for the frontend/template; visual rendering logic resides in HTML/CSS/JS, but the engine must provide the correct coordinates/points.
- **Performance**: efficiently handle hundreds of nodes without significant build time increase.

## Known context

- **Current State**: `compiler.py` contains a monolithic `process_groups` method that forces all groups into rectangular bounding boxes, regardless of the active layout engine.
- **Schema Promise**: The `TOPOLOGY_SCHEMA_GUIDE.md` specifies that `campus` and `radial` layouts should use organic "hull" shapes, while `city` uses "rect".
- **Architecture**: Layouts are applied sequentially, modifying node `x/y` coordinates. Grouping logic runs _after_ layout application.
- **Missing File**: The user referenced `PLAN_GROUPS_SEPARATION.md`, indicating a pre-existing intent to modularize this logic.

## Risks

- **Coordinate Systems**: Different layouts use different coordinate spaces (e.g., `radial_x` vs `x`). The separated Group Engine must handle these transparently.
- **Algorithm Complexity**: Implementing robust computational geometry (Convex Hull) in pure Python handles most cases but edge cases (collinear points, 2 points) need careful handling.
- **Visual Regression**: Changing from Rect to Hull might look different; we need to ensure the default remains "safe" or visually pleasing.

## Options

1.  **Modular Extraction & Hull Implementation (Recommended)**
    - Refactor `process_groups` into `engine/core/groups.py` as a `GroupProcessor` class.
    - Implement the Monotone Chain algorithm for Convex Hull calculation.
    - update `compiler.py` to delegate group processing to this new module.
    - output `polygon_points` for `hull` shape and `x/y/w/h` for `rect` shape.

2.  **Plugin Architecture Rewrite**
    - Redesign the entire Engine to use a plugin system for Layouts and Processors.
    - Pros: Highly extensible.
    - Cons: High effort, significant refactoring risk, potentially over-engineering for current scope.

3.  **In-Place Patch**
    - Add Convex Hull logic directly into `compiler.py`.
    - Pros: Quick.
    - Cons: Increases technical debt, bloats the compiler further, ignores the "Separation" intent.

## Recommendation

**Option 1**: Extract and enhance.
Create `engine/core/groups.py`. This aligns with the "Groups Separation" intent. It allows us to implementation the "Adaptive Groups" feature (Hulls for Campus/Radial) cleanly without cluttering the main compiler. It provides immediate visual value ("Premium Designs") by enabling organic group shapes.

## Acceptance criteria

- [ ] `process_groups` logic is removed from `NetworkCompiler` in `compiler.py`.
- [ ] New module `engine/core/groups.py` handles group calculation.
- [ ] `campus` and `radial` layouts generate `shape: hull` with a list of boundary points (`points: [[x1,y1],...]`).
- [ ] `city` layout continues to generate `shape: rect` with bounding box coordinates.
- [ ] `requirements.txt` remains unchanged (no new heavy deps).
