#!/usr/bin/env bash
set -euo pipefail

# Ensure we're in zkapp directory
if [[ "$(basename "$PWD")" != "zkapp" ]]; then
    echo "Error: You must run this script from the 'zkapp' directory."
    exit 1
fi

# Check CHARMS_BIN
if [[ -z "${CHARMS_BIN:-}" ]]; then
    echo "Error: CHARMS_BIN environment variable is not set."
    exit 1
fi

# Delete that target directory if it exists
if [[ -d target ]]; then
    echo "Removing existing 'target' directory..."
    rm -rf target
fi

# Run the binary with parameters
"$CHARMS_BIN" app build

# Assume "target" is created in the current directory after build
if [[ ! -d target ]]; then
    echo "Error: 'target' directory not found after build."
    exit 1
fi

# Create ../bin if it doesn't exist
mkdir -p ../bin

# Copy contents from target to ../bin
cp -r target/* ../bin/

echo "Build output copied to ../bin successfully."
