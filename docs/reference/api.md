# API Reference

This document provides a technical reference for the internal Python modules and the HTTP API provided by the development server.

## Core Engine

### NetworkCompiler

Located in `engine.core.compiler`.

**Class**: `NetworkCompiler`

The central controller for the generation process.

- `__init__(name: str)`: Initializes the compiler with a process name.
- `load_yaml(filepath: str)`: Parses and loads the YAML topology file.
- `build(output_path: str)`: Executes the build pipeline and writes the output HTML.
- `validate()`: Trigger schema validation manually.

### SchemaValidator

Located in `engine.core.validator`.

**Class**: `SchemaValidator`

Enforces strict typing and structure on the input YAML.

- `__init__(filepath: str)`: Initializes with the path to the YAML file.
- `run() -> bool`: Executes validation rules. Returns `True` if valid.
- `errors`: List of validation errors found.
- `warnings`: List of non-critical warnings.

## Server API

The development server (`server.py`) exposes several HTTP endpoints for the integrated editor.

### File Management

#### `GET /api/files`

Lists all available content files in the input directory.

- **Response**: JSON object containing a list of files with their size and modification time.

#### `GET /api/load/<filename>`

Loads the content of a specific YAML file.

- **Parameters**: `filename` (URL path)
- **Response**: JSON containing `content` (string) of the file.

#### `POST /api/save/<filename>`

Saves content to the specified file.

- **Payload**: `{"yaml": "..."}`
- **Response**: JSON success/error status.

### Real-time Interaction

#### `GET /preview`

Renders the live diagram for the editor iframe. This performs a just-in-time compilation of the current active file.

#### `POST /validate_schema`

Runs a full validation pass on the current file.

- **Response**: JSON report of errors and warnings.

#### `POST /update_positions`

Surgically updates node positions in the YAML file without overwriting the entire content.

- **Payload**: `{"changes": [{"id": "NODE_ID", "x": 100, "y": 200, "type": "node"}]}`
- **Response**: JSON confirmation of update count.

#### `GET /get_icons`

Returns a list of all available icon paths for the asset picker.
