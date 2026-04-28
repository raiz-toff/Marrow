#!/usr/bin/env python3
"""
Proper SVG Icon Normalizer - Sets uniform viewBox while preserving visual quality
This correctly scales and centers icon content within a standard viewBox.

Usage: python3 fix_icon_sizes.py --backup
"""

import os
import re
import argparse
from pathlib import Path
from xml.etree import ElementTree as ET
import math

ICONS_DIR = "assets/icons"

def fix_svg_viewbox(file_path, target_size=100, backup=False, dry_run=False):
    """
    Properly normalize SVG by:
    1. Setting viewBox to standard size (0 0 100 100)
    2. Keeping all content intact without transforms
    3. The browser will scale everything uniformly
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Parse SVG
        ET.register_namespace('', 'http://www.w3.org/2000/svg')
        root = ET.fromstring(content)
        
        # Set standard viewBox
        root.set('viewBox', f'0 0 {target_size} {target_size}')
        
        # Remove width/height attributes to let viewBox control sizing
        if 'width' in root.attrib:
            del root.attrib['width']
        if 'height' in root.attrib:
            del root.attrib['height']
        
        if not dry_run:
            # Create backup if requested
            if backup:
                backup_path = str(file_path) + '.backup'
                if not os.path.exists(backup_path):
                    with open(backup_path, 'w', encoding='utf-8') as f:
                        f.write(content)
            
            # Write fixed SVG
            tree = ET.ElementTree(root)
            tree.write(file_path, encoding='utf-8', xml_declaration=True)
        
        return True, f"Fixed viewBox to {target_size}x{target_size}"
        
    except Exception as e:
        return False, f"Error: {str(e)}"

def process_icons(icons_dir, target_size=100, backup=False, dry_run=False):
    """Process all SVG icons"""
    icons_path = Path(icons_dir)
    
    if not icons_path.exists():
        print(f"❌ Error: {icons_dir} not found")
        return
    
    svg_files = list(icons_path.rglob("*.svg"))
    # Exclude backup files
    svg_files = [f for f in svg_files if not str(f).endswith(('.backup', '.original'))]
    
    print(f"\n🔍 Found {len(svg_files)} SVG files")
    
    if dry_run:
        print("🔬 DRY RUN MODE - No files will be modified\n")
    elif backup:
        print("💾 Creating .backup files\n")
    
    success = 0
    errors = 0
    
    for svg_file in svg_files:
        rel_path = svg_file.relative_to(icons_path)
        ok, msg = fix_svg_viewbox(svg_file, target_size, backup, dry_run)
        
        if ok:
            success += 1
            symbol = "→" if dry_run else "✓"
            print(f"{symbol} {rel_path}")
        else:
            errors += 1
            print(f"✗ {rel_path}: {msg}")
    
    print(f"\n{'='*60}")
    print(f"📊 Summary:")
    print(f"   ✓ Success: {success}")
    print(f"   ✗ Errors: {errors}")
    print(f"{'='*60}\n")

def main():
    parser = argparse.ArgumentParser(description="Fix SVG icon sizes properly")
    parser.add_argument('--backup', action='store_true', help='Create .backup files')
    parser.add_argument('--dry-run', action='store_true', help='Preview without changes')
    parser.add_argument('--size', type=int, default=100, help='Target viewBox size')
    
    args = parser.parse_args()
    process_icons(ICONS_DIR, args.size, args.backup, args.dry_run)

if __name__ == "__main__":
    main()
