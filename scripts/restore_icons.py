#!/usr/bin/env python3
"""
Restore SVG Icons from Backup Files
This script finds all .backup files and restores them to their original .svg names
"""

import os
import shutil
from pathlib import Path

def restore_backups(icons_dir="assets/icons"):
    """Restore all .backup files to .svg"""
    icons_path = Path(icons_dir)
    
    # Find all backup files
    backup_extensions = ['.backup', '.original', '.fixed_backup']
    backup_files = []
    
    for ext in backup_extensions:
        backup_files.extend(list(icons_path.rglob(f'*{ext}')))
    
    if not backup_files:
        print("❌ No backup files found!")
        print("\nSearched for files ending in:")
        for ext in backup_extensions:
            print(f"  - *{ext}")
        return
    
    print(f"\n🔍 Found {len(backup_files)} backup files")
    print("=" * 60)
    
    restored = 0
    errors = 0
    
    for backup_file in backup_files:
        try:
            # Determine the extension to remove
            ext_to_remove = None
            for ext in backup_extensions:
                if str(backup_file).endswith(ext):
                    ext_to_remove = ext
                    break
            
            if not ext_to_remove:
                continue
            
            # Calculate target filename
            target_file = str(backup_file).replace(ext_to_remove, '')
            
            # Copy backup to target (preserving backup)
            shutil.copy2(backup_file, target_file)
            
            restored += 1
            rel_path = backup_file.relative_to(icons_path)
            
            if restored <= 10:  # Show first 10
                print(f"✓ Restored: {rel_path}")
        
        except Exception as e:
            errors += 1
            print(f"✗ Error restoring {backup_file}: {e}")
    
    if restored > 10:
        print(f"... and {restored - 10} more files")
    
    print("=" * 60)
    print(f"\n📊 Summary:")
    print(f"   ✅ Restored: {restored} files")
    if errors:
        print(f"   ❌ Errors: {errors}")
    print(f"   💾 Backup files kept intact")
    print()

if __name__ == "__main__":
    restore_backups()
