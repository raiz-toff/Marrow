#!/usr/bin/env python3
import sys
import os
import argparse

# Ensure the current directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engine.core.validator import SchemaValidator

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate Network Topology YAML Schema V2")
    parser.add_argument("file", help="Path to the .yaml file to validate")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"❌ Error: File '{args.file}' not found.")
        sys.exit(1)

    validator = SchemaValidator(args.file)
    success = validator.run()
    
    sys.exit(0 if success else 1)
