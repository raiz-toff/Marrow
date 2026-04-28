# Finish: Layout & Groups Engine Improvements

## Summary of Changes

- **Modularized Group Processing**: Extracted hardcoded group calculation logic from `NetworkCompiler` into a new, dedicated `GroupProcessor` class in `engine/core/groups.py`.
- **Adaptive Visual Shapes**: Implemented logic to automatically select the most appropriate group shape based on the active layout engine:
  - **Convex Hulls (`shape: hull`)**: Now the default for `campus` and `radial` layouts, providing organic, "premium" visual clustering.
  - **Rectangles (`shape: rect`)**: Maintained as the default for `city` layout to respect the Manhattan grid alignment.
- **Improved Maintainability**: `compiler.py` is now cleaner and easier to maintain, with group-specific logic isolated.

## Verification Results

- **Module Loading**: `engine.core.groups` verified to load correctly via CLI.
- **Build Integrity**: `python3 main.py build` runs successfully with the new architecture.
- **Data Validation**: Inspected generated HTML; confirmed `hull` shapes are output for campus layouts and `rect` for city layouts.

## Manual Validation Steps

- Open the generated `inter_vlan_lab.html` (or any topology) in a browser.
- Switch to **Campus** or **Radial** view in the sidebar.
- Observe that groups now form organic, rounded shapes (Convex Hulls) around their member nodes instead of just squares.
- Switch to **City** view and verify groups are still rectangular.
