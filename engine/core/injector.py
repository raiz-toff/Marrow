import re
import os

def update_node_position(file_path, node_id, x, y):
    """
    Updates the x and y coordinates of a node in the YAML file.
    Preserves comments and structure by processing line-by-line.
    """
    if not os.path.exists(file_path):
        return False
        
    with open(file_path, 'r') as f:
        lines = f.readlines()
        
    new_lines = []
    in_target_node = False
    indent = ""
    x_updated = False
    y_updated = False
    
    # Simple state machine
    for i, line in enumerate(lines):
        # Detect node start (assuming list item)
        # Match: - id: "node_id" or - id: node_id
        # We need to be careful about matching exact ID
        match = re.search(r'^\s*-\s*id:\s*["\']?([^"\']+)["\']?', line)
        
        if match:
            current_id = match.group(1)
            if current_id == node_id:
                in_target_node = True
                # Capture indentation of the properties (usually 2 or 4 spaces)
                # The line starts with spaces, then '-', so indentation of props is usually same as '-' + 2
                base_indent = re.match(r'^\s*', line).group(0)
                indent = base_indent + "  " 
            else:
                in_target_node = False
        
        if in_target_node:
            # Check if we've left the node block (next line has same or less indentation as the start start string '-')
            # Actually, next list item starts with '-' at same indent level
            if i > 0 and line.strip().startswith('- id:'):
                if match and match.group(1) != node_id:
                     in_target_node = False

            # OR if we hit a top level key (no indent)
            if line and not line.startswith(' ') and not line.startswith('-') and ':' in line:
                in_target_node = False

        if in_target_node:
            # Update X
            if re.match(r'^\s*x:', line):
                line = f"{indent}x: {x}\n"
                x_updated = True
            # Update Y
            elif re.match(r'^\s*y:', line):
                line = f"{indent}y: {y}\n"
                y_updated = True
                
        new_lines.append(line)
        
        # If we are at the end of the node block, and we haven't updated X/Y, we should insert them
        # This is tricky line-by-line. 
        # Easier strategy: Pass 1 update existing. Pass 2 insert if missing?
        # Or just insert right after 'id' or 'label'?
        
    # Re-process to insert if missing
    # This is getting complicated for a quick fix. 
    # Let's trust that if the visual editor is sending updates, the nodes might already have X/Y or we append them.
    
    # Refined approach:
    # If found target node, look for x/y in its block.
    # If the block ends without finding them, insert them.
    
    final_lines = []
    in_target_node = False
    node_found = False
    inserted_coords = False
    
    current_node_start_idx = -1
    
    for i, line in enumerate(lines):
        match = re.search(r'^(\s*)-\s*id:\s*["\']?([^"\']+)["\']?', line)
        if match:
            if in_target_node and not inserted_coords:
                # We are starting a NEW node, but finished the TARGET node without inserting coords
                 # Append to the end of the PREVIOUS node (which is actually just before this line)
                 # But we've already added previous lines to new_lines?
                 # Let's restart the logic.
                 pass
            
            if match.group(2) == node_id:
                in_target_node = True
                node_found = True
                indent = match.group(1) + "    " # Standard indentation guess
                inserted_coords = False
            else:
                in_target_node = False
        
        # Detect end of block by indentation or next list item
        is_list_item = line.strip().startswith('-')
        is_top_level = line and not line.startswith(' ') and ':' in line
        
        if in_target_node and (is_list_item and not match) or is_top_level:
            # We left the block
            if not inserted_coords:
                # Insert before this line
                if not x_updated: final_lines.append(f"{indent}x: {x}\n")
                if not y_updated: final_lines.append(f"{indent}y: {y}\n")
                inserted_coords = True
            in_target_node = False
            
        # Replace existing
        if in_target_node:
             if re.match(r'^\s+x:', line):
                 line = f"{indent}x: {x}\n"
                 x_updated = True
                 inserted_coords = True # semi-true, at least we found one
             elif re.match(r'^\s+y:', line):
                 line = f"{indent}y: {y}\n"
                 y_updated = True
        
        final_lines.append(line)

    # Handle case where file ends while inside target node
    if in_target_node and not inserted_coords:
        if not x_updated: final_lines.append(f"{indent}x: {x}\n")
        if not y_updated: final_lines.append(f"{indent}y: {y}\n")
        
    with open(file_path, 'w') as f:
        f.writelines(final_lines)
        
    return True

def update_annotation_position(file_path, text_snippet, x, y):
    """
    Updates annotation position based on text content match.
    """
    if not os.path.exists(file_path):
        return False
        
    with open(file_path, 'r') as f:
        lines = f.readlines()
        
    final_lines = []
    in_annotation = False
    match_found = False
    indent = "    "
    
    # This is a heuristic - finding an annotation by its text content
    # YAML:
    # annotations:
    #   - type: text
    #     text: "Core"
    #     x: 100
    #     y: 100
    
    for i, line in enumerate(lines):
        # Naive detection of annotation block
        # If we see 'annotations:', start looking
        # If we see ' - type:', it's a new item
        
        stripped = line.strip()
        if stripped.startswith('- type:'):
            in_annotation = True
            match_found = False # New item, reset match
            
        if in_annotation:
            if f'text: "{text_snippet}"' in line or f"text: {text_snippet}" in line:
                match_found = True
                # Get indent
                match = re.match(r'^(\s*)text:', line)
                if match: indent = match.group(1)
        
        # If we are in the correct annotation
        if in_annotation and match_found:
             if re.match(r'^\s+x:', line):
                 line = f"{indent}x: {x}\n"
             elif re.match(r'^\s+y:', line):
                 line = f"{indent}y: {y}\n"
                 
        final_lines.append(line)
        
    with open(file_path, 'w') as f:
        f.writelines(final_lines)
        
    return True
