import os
import base64

def get_icon_data(type_name, assets_path="assets/icons/"):
    """Finds and encodes icons from assets/icons/ folder."""
    extensions = ['svg', 'png']
    icon_path = None
    
    for ext in extensions:
        path = os.path.join(assets_path, f"{type_name}.{ext}")
        if os.path.exists(path):
            icon_path = path
            break
    
    if not icon_path:
        return None
        
    try:
        with open(icon_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode('utf-8')
            
        mime = "image/svg+xml" if icon_path.endswith('svg') else "image/png"
        return f"data:{mime};base64,{encoded}"
    except Exception as e:
        print(f"Error encoding icon {type_name}: {e}")
        return None
