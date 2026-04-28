#!/usr/bin/env python3
"""
SVG Icon Normalizer - Resize all SVG icons to a consistent viewBox size
This ensures all icons render at the same visual size in your diagrams.

Usage:
    python3 normalize_icons.py --size 50 --backup
    
Options:
    --size: Target size (default: 50x50)
    --backup: Create .original backups before modifying
    --dry-run: Preview changes without modifying files
"""

import os
import sys
import argparse
import xml.etree.ElementTree as ET
from pathlib import Path
import shutil

ICONS_DIR = "assets/icons"

def normalize_svg(file_path, target_size=50, dry_run=False):
    """Normalize an SVG file to a consistent viewBox size"""
    try:
        # Parse SVG
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # Register SVG namespace
        ET.register_namespace('', 'http://www.w3.org/2000/svg')
        
        # Get current viewBox or calculate from width/height
        viewbox = root.get('viewBox')
        
        if viewbox:
            # Parse existing viewBox: "x y width height"
            parts = viewbox.split()
            if len(parts) == 4:
                x, y, w, h = map(float, parts)
            else:
                return False, "Invalid viewBox format"
        else:
            # Try to get from width/height attributes
            width = root.get('width', '50')
            height = root.get('height', '50')
            
            # Clean up width/height (remove units like 'px', 'pt')
            width = float(''.join(c for c in width if c.isdigit() or c == '.'))
            height = float(''.join(c for c in height if c.isdigit() or c == '.'))
            
            x, y, w, h = 0, 0, width, height
        
        # Calculate new viewBox (centered, preserving aspect ratio)
        aspect = w / h
        
        if aspect > 1:
            # Wider than tall
            new_width = target_size
            new_height = target_size / aspect
            new_x = 0
            new_y = (target_size - new_height) / 2
        else:
            # Taller than wide
            new_height = target_size
            new_width = target_size * aspect
            new_x = (target_size - new_width) / 2
            new_y = 0
        
        # Calculate scale factor
        scale_x = new_width / w
        scale_y = new_height / h
        
        # Update viewBox to standard size, but keep content proportional
        new_viewbox = f"0 0 {target_size} {target_size}"
        
        # Apply transformation to content
        # Wrap all content in a group with transform
        children = list(root)
        
        # Create wrapper group
        wrapper = ET.Element('g')
        wrapper.set('transform', f'translate({new_x}, {new_y}) scale({scale_x}, {scale_y})')
        
        # Move all children into wrapper
        for child in children:
            root.remove(child)
            wrapper.append(child)
        
        root.append(wrapper)
        
        # Set new attributes
        root.set('viewBox', new_viewbox)
        root.set('width', str(target_size))
        root.set('height', str(target_size))
        
        if not dry_run:
            # Write back
            tree.write(file_path, encoding='utf-8', xml_declaration=True)
        
        return True, f"Normalized to {target_size}x{target_size}"
        
    except Exception as e:
        return False, f"Error: {str(e)}"

def process_directory(icons_dir, target_size=50, backup=False, dry_run=False):
    """Process all SVG files in the directory"""
    icons_path = Path(icons_dir)
    
    if not icons_path.exists():
        print(f"❌ Error: {icons_dir} not found")
        return
    
    # Find all SVG files
    svg_files = list(icons_path.rglob("*.svg"))
    
    print(f"\n🔍 Found {len(svg_files)} SVG files")
    
    if dry_run:
        print("🔬 DRY RUN MODE - No files will be modified\n")
    
    if backup and not dry_run:
        print("💾 Backup mode enabled - Creating .original files\n")
    
    success_count = 0
    error_count = 0
    
    for svg_file in svg_files:
        relative_path = svg_file.relative_to(icons_path)
        
        # Create backup if requested
        if backup and not dry_run:
            backup_path = str(svg_file) + ".original"
            if not os.path.exists(backup_path):
                shutil.copy2(svg_file, backup_path)
        
        # Normalize the SVG
        success, message = normalize_svg(svg_file, target_size, dry_run)
        
        if success:
            success_count += 1
            status = "✓" if not dry_run else "→"
            print(f"{status} {relative_path}: {message}")
        else:
            error_count += 1
            print(f"✗ {relative_path}: {message}")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"📊 Summary:")
    print(f"   ✓ Successfully processed: {success_count}")
    print(f"   ✗ Errors: {error_count}")
    print(f"   📁 Total files: {len(svg_files)}")
    
    if dry_run:
        print(f"\n💡 Run without --dry-run to apply changes")
    elif backup:
        print(f"\n💾 Original files saved with .original extension")
    
    print(f"{'='*60}\n")

def main():
    parser = argparse.ArgumentParser(
        description="Normalize all SVG icons to a consistent size",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview changes (dry run)
  python3 normalize_icons.py --dry-run
  
  # Normalize to 50x50 with backup
  python3 normalize_icons.py --size 50 --backup
  
  # Normalize to 100x100 without backup
  python3 normalize_icons.py --size 100
        """
    )
    
    parser.add_argument('--size', type=int, default=50,
                        help='Target size for icons (default: 50)')
    parser.add_argument('--backup', action='store_true',
                        help='Create .original backup files')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without modifying files')
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("\n⚠️  DRY RUN MODE - No files will be modified")
    
    if args.size < 10 or args.size > 500:
        print("❌ Error: Size must be between 10 and 500")
        sys.exit(1)
    
    process_directory(ICONS_DIR, args.size, args.backup, args.dry_run)

if __name__ == "__main__":
    main()
