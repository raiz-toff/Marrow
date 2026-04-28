# CLI Reference

The project provides several command-line tools for building, validating, and managing icons.

## main.py (The Unified Tool)

The recommended entry point for all major tasks.

### Build a Diagram

```bash
python3 main.py build --input input/my_plan.yaml --output output/result.html
```

- `--input`, `-i`: Path to the source YAML.
- `--output`, `-o`: (Optional) Custom output path.

### Validate a Schema

```bash
python3 main.py validate docs/extreme_schema_example.yaml
```

## Specialized Script Entry Points

While `main.py` is the primary entry point, the legacy/wrapper scripts are still available for convenience.

### generator.py

A wrapper around the build process.

```bash
python3 generator.py --input input/plan.yaml
```

### schema_validator.py

A wrapper around the validation logic.

```bash
python3 schema_validator.py input/plan.yaml
```

## Icon Management (scripts/)

### scripts/browse_icons.py

Search the massive library of 900+ Cisco icons from your terminal.

```bash
python3 scripts/browse_icons.py router
```

### scripts/normalize_icons.py

Standardizes SVG viewboxes for consistent rendering. Use this after adding new custom icons.

```bash
python3 scripts/normalize_icons.py
```

## Live Development Server

### server.py

Runs a local Flask server that provides a "Live Preview" of your diagram.

```bash
python3 server.py
```

- **Access**: `http://localhost:5000`
- **Features**:
 - Auto-reloads diagram when `input/plan.yaml` is saved.
 - Includes a built-in YAML editor at `/editor`.
 - Integrated icon browser for discovering paths while typing YAML.
