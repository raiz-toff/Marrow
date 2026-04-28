#!/usr/bin/env python3
import sys
import os

# Ensure the current directory is in the path so we can import 'engine'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from engine.core.compiler import NetworkCompiler

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Network Diagram Generator')
    parser.add_argument('--input', default='input/plan.yaml', help='Input YAML file')
    parser.add_argument('--output', help='Output HTML file path')
    
    args = parser.parse_args()
    
    compiler = NetworkCompiler()
    
    # Check if input file exists
    if not os.path.exists(args.input):
        print(f"❌ Error: Input file '{args.input}' not found.")
        sys.exit(1)
        
    compiler.load_yaml(args.input)
    compiler.build(output_path=args.output)
