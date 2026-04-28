# Deployment Guide

This guide covers the requirements and steps to run the Network Generator in a production or local environment.

## Requirements

- **Operating System**: Linux (Recommended), macOS, or Windows
- **Python**: Version 3.8 or higher
- **Dependencies**: Listed in `requirements.txt`

## Installation

1. Clone the repository to your local machine or server.
2. Navigate to the project directory:

  ```bash
  cd tools/network_generator
  ```

3. Install the required Python packages:

  ```bash
  pip install -r requirements.txt
  ```

  _Recommended: Use a virtual environment._

  ```bash
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
  ```

## Running the Application

### Command Line Interface (CLI)

Use the unified `main.py` entry point for batch processing.

**Build a Diagram:**

```bash
python3 main.py build --input input/plan.yaml --output output/network.html
```

**Validate a Schema:**

```bash
python3 main.py validate input/plan.yaml
```

### Live Development Server

For an interactive editing experience, run the Flask server:

```bash
python3 server.py
```

- **URL**: `http://localhost:5000`
- **Host**: By default, it binds to `0.0.0.0`, making it accessible across the network if firewall rules permit.

## Output Generation

The generator produces **Static HTML** files.

- **Offline First**: The generated HTML files embed all necessary CSS, JavaScript, and SVG assets.
- **No Dependencies**: The output file does not require a backend server to view. It can be opened directly in any web browser.
- **Portability**: You can email the HTML file or host it on any static web server (Nginx, Apache, GitHub Pages).

## Directory Structure

Ensure your deployment maintains the following structure for correct asset resolution:

```text
network_generator/
├── assets/       # Icon libraries and static resources
├── config/       # Configuration defaults
├── engine/       # Core application logic
├── input/       # YAML topology files provided by user
├── output/       # Generated HTML files
├── templates/     # Jinja2 HTML templates
├── main.py       # CLI entry point
└── server.py      # Web server entry point
```
