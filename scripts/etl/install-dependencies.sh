#!/bin/bash
# Install dependencies for ETL scripts

echo "Installing ETL script dependencies..."
cd "$(dirname "$0")" || exit

# Install with bun
if command -v bun &>/dev/null; then
	bun install
else
	# Fallback to npm
	npm install
fi

echo "ETL dependencies installed successfully!"
