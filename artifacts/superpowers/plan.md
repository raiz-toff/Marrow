# Plan: Layout & Groups Engine Improvements

## Goal

Decouple Group processing from the core Compiler and enable specific implementations for different layouts (Rect for City, Hull for Campus/Radial) to unlock the "Premium" visual capabilities already present in the frontend.

## Assumptions

- The frontend (`scripts.html`) already supports `shape: hull` via client-side Convex Hull calculation.
- We do not need to implement Convex Hull in Python for `campus` layout, as the client handles it dynamically.
- Existing YAML files should continue to work without changes.

## Plan

### Step 1: Create Group Processor Module

- **Files**: `engine/core/groups.py`
- **Change**:
  - Create a new module `engine/core/groups.py`.
  - Implement `GroupProcessor` class with a static method `process_groups(nodes, raw_groups, layout_mode)`.
  - Move logic from `compiler.py` into this method.
  - **Crucial Update**: Add logic to enforce `shape: hull` for `campus` and `radial` modes, and `shape: rect` for `city` mode.
- **Verify**: `python3 -c "from engine.core.groups import GroupProcessor; print('Module loaded')"`

### Step 2: Integrate Group Processor into Compiler

- **Files**: `engine/core/compiler.py`
- **Change**:
  - Import `GroupProcessor` from `engine.core.groups`.
  - Replace the hardcoded `process_groups` method body with a call to `GroupProcessor.process_all(self.nodes, self.raw_groups)`.
  - Remove the old monolithic `process_groups` method if it's no longer needed (or keep as wrapper).
- **Verify**: Run `python3 server.py` and check if `plan.yaml` still loads without errors.

### Step 3: Validate Visual Output

- **Files**: None (Verification only)
- **Change**:
  - Trigger a rebuild of the diagram.
  - Check the generated HTML source (or `plan.json` if debug enabled) to ensure `campus` groups now have `shape: hull`.
- **Verify**: Check output HTML content for `\"shape\": \"hull\"` string presence.

## Risks & mitigations

- **Risk**: The frontend `rect` fallback might override the `hull` if parameters are missing.
- **Mitigation**: Ensure `GroupProcessor` still calculates a formatting bounding box (x,y,w,h) even for hulls, just as a safety fallback, but explicitly sets `shape: hull`.

## Rollback plan

- Revert `engine/core/compiler.py` to previous state.
- Delete `engine/core/groups.py`.
