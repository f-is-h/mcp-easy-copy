#!/bin/bash

# Change to the directory where the script is located
cd "$(dirname "$0")"

# Build the project
npm run build

# Show success message
echo "Build completed successfully!"
echo "To use this MCP service, configure it in Claude Desktop."

