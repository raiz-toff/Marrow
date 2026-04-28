#!/usr/bin/env python3
import sys
import os
import argparse

from engine.core.compiler import NetworkCompiler
from engine.core.validator import SchemaValidator

def main():
    parser = argparse.ArgumentParser(description='Network Generator & Validator')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # Build command
    build_parser = subparsers.add_parser('build', help='Build a network diagram')
    build_parser.add_argument('--input', '-i', default='input/plan.yaml', help='Input file (yaml/json/svg/unl)')
    build_parser.add_argument('--output', '-o', help='Output HTML file path')

    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate a schema file')
    validate_parser.add_argument('file', help='Path to the .yaml file to validate')

    args = parser.parse_args()

    if args.command == 'build':
        compiler = NetworkCompiler()
        if not os.path.exists(args.input):
            print(f"❌ Error: Input file '{args.input}' not found.")
            sys.exit(1)
        compiler.load_source(args.input)
        compiler.build(output_path=args.output)
    
    elif args.command == 'validate':
        if not os.path.exists(args.file):
            print(f"❌ Error: File '{args.file}' not found.")
            sys.exit(1)
        validator = SchemaValidator(args.file)
        success = validator.run()
        sys.exit(0 if success else 1)
    
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
