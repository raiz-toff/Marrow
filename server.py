from flask import Flask, render_template, request, jsonify, send_from_directory
from engine.core.compiler import NetworkCompiler
from engine.core.validator import SchemaValidator
import os
import traceback

app = Flask(__name__, template_folder='templates')

# --- CONFIGURATION ---
INPUT_DIR = 'input'
DEFAULT_FILE = 'plan.yaml'
ASSETS_DIR = 'assets'

# Track current file being edited (can be changed via API)
current_file = DEFAULT_FILE

def get_current_file_path():
    """Get full path to currently selected file."""
    return os.path.join(INPUT_DIR, current_file)

# ═══════════════════════════════════════════════════════════════════════════
# FILE MANAGEMENT API
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/api/files')
def api_list_files():
    """List all YAML files in the input directory."""
    try:
        files = []
        if os.path.exists(INPUT_DIR):
            for f in os.listdir(INPUT_DIR):
                if f.endswith('.yaml') or f.endswith('.yml'):
                    filepath = os.path.join(INPUT_DIR, f)
                    stat = os.stat(filepath)
                    files.append({
                        'name': f,
                        'size': stat.st_size,
                        'modified': stat.st_mtime
                    })
        # Sort by name
        files.sort(key=lambda x: x['name'])
        return jsonify({
            'success': True, 
            'files': files,
            'current': current_file
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/load/<filename>')
def api_load_file(filename):
    """Load a specific YAML file and set it as current."""
    global current_file
    try:
        # Security: prevent directory traversal
        if '..' in filename or '/' in filename:
            return jsonify({'success': False, 'error': 'Invalid filename'})
        
        filepath = os.path.join(INPUT_DIR, filename)
        if not os.path.exists(filepath):
            return jsonify({'success': False, 'error': f'File not found: {filename}'})
        
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Update current file
        current_file = filename
        
        return jsonify({
            'success': True, 
            'content': content,
            'filename': filename
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/save/<filename>', methods=['POST'])
def api_save_file(filename):
    """Save content to a specific YAML file."""
    global current_file
    try:
        # Security: prevent directory traversal
        if '..' in filename or '/' in filename:
            return jsonify({'success': False, 'error': 'Invalid filename'})
        
        data = request.json
        content = data.get('yaml')
        if content is None:
            return jsonify({'success': False, 'error': 'No content provided'})
        
        # Ensure input directory exists
        os.makedirs(INPUT_DIR, exist_ok=True)
        
        filepath = os.path.join(INPUT_DIR, filename)
        with open(filepath, 'w') as f:
            f.write(content)
        
        # Update current file
        current_file = filename
        
        # Validation pass
        try:
            compiler = NetworkCompiler("Validation Check")
            compiler.load_yaml(filepath)
            return jsonify({
                'success': True,
                'message': f'✅ {filename} saved & compiled successfully.',
                'filename': filename
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'⚠️ {filename} saved, but has errors: {str(e)}',
                'filename': filename
            })
    except Exception as e:
        return jsonify({'success': False, 'error': f'❌ System Error: {str(e)}'})

@app.route('/api/current', methods=['GET', 'POST'])
def api_current_file():
    """Get or set the current file being edited."""
    global current_file
    if request.method == 'POST':
        data = request.json
        filename = data.get('filename')
        if filename and '..' not in filename and '/' not in filename:
            filepath = os.path.join(INPUT_DIR, filename)
            if os.path.exists(filepath):
                current_file = filename
                return jsonify({'success': True, 'current': current_file})
        return jsonify({'success': False, 'error': 'Invalid or missing filename'})
    else:
        return jsonify({'success': True, 'current': current_file})

# ═══════════════════════════════════════════════════════════════════════════
# MAIN ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    """Default to the Editor for live development."""
    return render_template('editor.html')

@app.route('/preview')
def preview():
    """Render the live diagram for the editor's iframe."""
    try:
        compiler = NetworkCompiler("Network Compiler (Live)")
        
        input_file = get_current_file_path()
        if not os.path.exists(input_file):
            return f"""
            <div style="color: #ffaa00; font-family: monospace; padding: 2rem; background: #111; height: 100vh;">
                <h1>⚠️ No File Found</h1>
                <p>Please create <code>{current_file}</code> or select a different file.</p>
            </div>
            """
            
        compiler.load_yaml(input_file)

        return render_template('diagram.html', 
                             title=compiler.title, 
                             description=compiler.description,
                             project_url=compiler.project_url,
                             nodes=compiler.nodes, 
                             edges=compiler.edges,
                             config=compiler.config,
                             groups=compiler.groups_data,
                             annotations=compiler.annotations)
    except Exception as e:
        return f"""
        <div style="color: #ff4444; font-family: monospace; padding: 2rem; background: #111; height: 100vh; overflow: auto;">
            <h1>🚨 Render Error</h1>
            <pre style="background: #222; padding: 1rem; border-radius: 4px;">{str(e)}</pre>
            <details>
                <summary>StackTrace</summary>
                <pre style="font-size: 0.8rem; opacity: 0.7;">{traceback.format_exc()}</pre>
            </details>
        </div>
        """

@app.route('/get_yaml')
def get_yaml():
    """Load the current YAML content for the editor."""
    try:
        input_file = get_current_file_path()
        if not os.path.exists(input_file):
            # Return a template if file doesn't exist
            template = "title: \"New Network\"\ndescription: \"Draft topology\"\n\nnodes:\n  - id: \"core-01\"\n    label: \"Core Switch\"\n    level: 1\n\nlinks:\n"
            return jsonify({'success': True, 'content': template, 'filename': current_file})
            
        with open(input_file, 'r') as f:
            content = f.read()
        return jsonify({'success': True, 'content': content, 'filename': current_file})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/save_yaml', methods=['POST'])
def save_yaml():
    """Save editor content and trigger a compiler validation pass."""
    try:
        data = request.json
        content = data.get('yaml')
        if content is None:
             return jsonify({'success': False, 'error': 'No content provided'})
        
        # Ensure input directory exists
        input_file = get_current_file_path()
        os.makedirs(INPUT_DIR, exist_ok=True)
        
        # Save to file
        with open(input_file, 'w') as f:
            f.write(content)
            
        # Internal Validation Pass (Compiler level)
        try:
             compiler = NetworkCompiler("Validation Check")
             compiler.load_yaml(input_file)
             return jsonify({
                 'success': True, 
                 'message': f'✅ {current_file} saved & compiled successfully.',
                 'filename': current_file
             })
        except Exception as e:
             return jsonify({
                 'success': False, 
                 'error': f"⚠️ YAML Saved, but has errors: {str(e)}"
             })

    except Exception as e:
        return jsonify({'success': False, 'error': f"❌ System Error: {str(e)}"})

@app.route('/validate_schema', methods=['GET'])
def validate_schema():
    """Run the deep schema validator and return JSON report."""
    try:
        input_file = get_current_file_path()
        validator = SchemaValidator(input_file)
        # We need to capture the output or return structured data. 
        # Modifying validator to return structured results would be better, 
        # but for now we'll just check success.
        success = validator.run()
        return jsonify({
            'success': success,
            'errors': validator.errors,
            'warnings': validator.warnings
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

from engine.core.injector import update_node_position, update_annotation_position

@app.route('/update_positions', methods=['POST'])
def update_positions():
    """Surgical update of node/annotation positions while preserving YAML structure."""
    try:
        input_file = get_current_file_path()
        changes = request.json.get('changes', [])
        success_count = 0
        
        for change in changes:
            type_ = change.get('type')
            x = change.get('x')
            y = change.get('y')
            
            if type_ == 'node':
                if update_node_position(input_file, change['id'], x, y):
                    success_count += 1
            elif type_ == 'annotation':
                # For annotations, we might use a snippet or ID if available
                # Currently simple matching by text snippet
                if update_annotation_position(input_file, change['text'], x, y):
                    success_count += 1
                    
        return jsonify({'success': True, 'updated': success_count})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/get_icons')
def get_icons():
    """Inventory search for the editor's icon picker."""
    icons = []
    base_dir = os.path.join(ASSETS_DIR, 'icons')
    if not os.path.exists(base_dir):
        return jsonify({'success': False, 'error': f'Icons directory not found at {base_dir}'})
        
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.svg') or file.endswith('.png'):
                # Get relative path starting from 'Cisco/' or whatever is inside 'icons/'
                rel_dir = os.path.relpath(root, base_dir)
                if rel_dir == '.':
                    icon_name = os.path.splitext(file)[0]
                else:
                    icon_name = os.path.join(rel_dir, os.path.splitext(file)[0])
                icons.append(icon_name)
                
    return jsonify({'success': True, 'icons': icons})

@app.route('/assets/<path:path>')
def serve_assets(path):
    """Fallback asset serving."""
    return send_from_directory(ASSETS_DIR, path)

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 NET.COMMAND CENTER RUNNING")
    print(f"🔗 URL: http://0.0.0.0:5000")
    print(f"📝 Active File: {get_current_file_path()}")
    print("==================================================")
    app.run(host='0.0.0.0', port=5000, debug=True)
