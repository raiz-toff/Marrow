#!/usr/bin/env python3
import re
import os
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

def extract_numbers(text):
    return [float(x) for x in re.findall(r'-?\d+\.?\d*', text)]

def get_svg_bounds(file_path):
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        coords_x = []
        coords_y = []
        
        def recurse(elem):
            for attr in ['x', 'y', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2']:
                if attr in elem.attrib:
                    try:
                        val = float(elem.attrib[attr])
                        if attr.startswith('x') or attr == 'cx': coords_x.append(val)
                        else: coords_y.append(val)
                    except: pass
            if 'd' in elem.attrib:
                nums = extract_numbers(elem.attrib['d'])
                for i, n in enumerate(nums):
                    if i % 2 == 0: coords_x.append(n)
                    else: coords_y.append(n)
            for child in elem: recurse(child)
        
        recurse(root)
        if not coords_x: return None
        return min(coords_x), min(coords_y), max(coords_x) - min(coords_x), max(coords_y) - min(coords_y)
    except: return None

def normalize_svg(file_path):
    bounds = get_svg_bounds(file_path)
    if not bounds: return False
    
    x, y, w, h = bounds
    if w == 0 or h == 0: return False
    
    # Calculate scaling to fit in 90x90 (with 5px margin in 100x100)
    target_inner = 90.0
    scale = target_inner / max(w, h)
    
    # Calculate translation to center
    new_w = w * scale
    new_h = h * scale
    tx = (100.0 - new_w) / 2.0 - (x * scale)
    ty = (100.0 - new_h) / 2.0 - (y * scale)
    
    try:
        # We rewrite the file with a clean structure
        # Standardize the namespaces
        ET.register_namespace('', 'http://www.w3.org/2000/svg')
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # Create a wrapper group for centering
        wrapper = ET.Element('{http://www.w3.org/2000/svg}g')
        wrapper.set('transform', f'translate({tx:.4f}, {ty:.4f}) scale({scale:.4f})')
        
        # Move all current children to the wrapper
        children = list(root)
        for child in children:
            root.remove(child)
            wrapper.append(child)
        
        root.append(wrapper)
        
        # Clean root attributes
        for attr in ['width', 'height', 'x', 'y']:
            if attr in root.attrib: del root.attrib[attr]
            
        root.set('viewBox', '0 0 100 100')
        root.set('preserveAspectRatio', 'xMidYMid meet')
        
        tree.write(file_path, encoding='utf-8', xml_declaration=True)
        return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    icons_dir = Path("assets/icons")
    svg_files = list(icons_dir.rglob("*.svg"))
    print(f"Normalizing {len(svg_files)} icons...")
    
    success = 0
    for f in svg_files:
        if normalize_svg(f):
            success += 1
            
    print(f"✅ Successfully normalized {success} icons to 0 0 100 100 square frame.")

if __name__ == "__main__":
    main()
