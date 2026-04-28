# 🌐 Network Topology Generator 2.0

A professional-grade system for compiling structured network data into interactive, multi-view diagrams. Built for network architects and engineers who need a "Single Source of Truth" for complex topologies.

![Project Status](https://img.shields.io/badge/status-active-emerald)
![Language](https://img.shields.io/badge/language-python-blue)

---

## 🚀 Quick Start

1. **Install Dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

2. **Generate your first diagram**:

   ```bash
   # Build the default plan
   python3 main.py build
   ```

3. **View the result**:
   Open `static/projects/network-map/index.html` (or your configured output path) in any browser.

---

## 🏗️ Project Architecture

The project has been refactored into a modular engine-based structure:

- **`engine/`**: Core logic (compiler, validator, layouts).
- **`main.py`**: Unified CLI for all tasks.
- **`server.py`**: Live preview server with integrated editor.
- **`scripts/`**: Utility tools for icon management.
- **`docs/`**: Comprehensive technical documentation.

---

## 📖 Documentation Index

| Document                                              | Description                                        |
| :---------------------------------------------------- | :------------------------------------------------- |
| **[Architecture](./docs/ARCHITECTURE.md)**            | Technical design, data flow, and engine mechanics. |
| **[Schema Guide](./docs/SCHEMA_V2.md)**               | Reference for the YAML topology format.            |
| **[API Reference](./docs/API_REFERENCE.md)**          | Documentation for internal Python modules.         |
| **[CLI Reference](./docs/CLI_REFERENCE.md)**          | Usage guide for command-line tools.                |
| **[Visualization Research](./docs/VISUALIZATION.md)** | UI/UX concepts and advanced rendering logic.       |

---

## 🛠️ Key Features

- **Multi-Layout Support**: Instantly toggle between **City** (Semantic), **Radial** (Hierarchical), and **Campus** (Grid) views.
- **Tactical HUD**: Interactive node inspection with support for `running_config` and design documentation.
- **Professional Library**: 970+ Cisco-standard icons embedded directly into every output.
- **Auto-Bundling**: Intelligent detection of EtherChannels and logical trunks.
- **Offline First**: Generates self-contained HTML files with zero external dependencies.

---

## 🔬 Development & Validation

Validate your schema before building:

```bash
python3 main.py validate input/plan.yaml
```

Run the Live Editor:

```bash
python3 server.py
```

_Access at http://localhost:5000_

---

Designed for precision and clarity in network visualization.
