#!/bin/bash

# --- CONFIGURATION ---
PORT=5000
PYTHON_CMD="python3"

echo "🌐 Starting Network Generator Server in WSL..."

# Ensure we are in the script's directory
cd "$(dirname "$0")"

# Check if python3 is installed
if ! command -v $PYTHON_CMD &> /dev/null; then
    echo "❌ Error: python3 is not installed in WSL."
    exit 1
fi

# Install dependencies if needed
echo "📦 Checking dependencies..."
$PYTHON_CMD -m pip install -r requirements.txt --quiet

# Start the server
echo "🚀 NET.COMMAND CENTER launching on http://localhost:$PORT"
$PYTHON_CMD server.py
