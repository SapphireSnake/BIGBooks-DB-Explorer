#!/bin/bash
# Start a local web server to bypass CORS restrictions
echo "Starting BigBooks Explorer..."
echo "Opening browser..."

# Open browser after a slight delay to ensure server is up
(sleep 1 && open "http://localhost:8000") &

# Start Python's built-in HTTP server
python3 -m http.server 8000
