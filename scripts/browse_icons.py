#!/usr/bin/env python3
"""
Icon Browser - List all available icons with search capability
Usage: python3 browse_icons.py [search_term]
"""

import os
import sys
from pathlib import Path

ICONS_DIR = "assets/icons/Cisco"

def get_all_icons():
    """Retrieve all icon paths organized by category"""
    icons = {}
    base_path = Path(ICONS_DIR)
    
    if not base_path.exists():
        print(f"Error: {ICONS_DIR} not found")
        return icons
    
    for category_dir in sorted(base_path.iterdir()):
        if category_dir.is_dir():
            category = category_dir.name
            icons[category] = []
            
            for icon_file in sorted(category_dir.glob("*.svg")):
                # Remove .svg extension and construct path
                icon_name = icon_file.stem
                icon_path = f"Cisco/{category}/{icon_name}"
                icons[category].append(icon_path)
    
    return icons

def search_icons(query):
    """Search for icons matching the query"""
    all_icons = get_all_icons()
    results = []
    
    query_lower = query.lower()
    
    for category, icons in all_icons.items():
        for icon in icons:
            if query_lower in icon.lower():
                results.append(icon)
    
    return results

def display_all():
    """Display all icons organized by category"""
    all_icons = get_all_icons()
    
    total = sum(len(icons) for icons in all_icons.values())
    print(f"\n🎨 Found {total} icons across {len(all_icons)} categories\n")
    
    for category, icons in all_icons.items():
        print(f"\n{'='*60}")
        print(f"📂 {category} ({len(icons)} icons)")
        print(f"{'='*60}\n")
        
        for icon in icons:
            print(f"  {icon}")

def display_search_results(query):
    """Display icons matching search query"""
    results = search_icons(query)
    
    if not results:
        print(f"\n❌ No icons found matching '{query}'\n")
        return
    
    print(f"\n🔍 Found {len(results)} icon(s) matching '{query}':\n")
    
    for icon in results:
        print(f"  ✓ {icon}")
    
    print(f"\n💡 Copy and paste the icon path into your plan.yaml:")
    print(f"   icon: {results[0]}\n")

def main():
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        display_search_results(query)
    else:
        display_all()

if __name__ == "__main__":
    main()
