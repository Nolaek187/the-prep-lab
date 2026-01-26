#!/bin/bash

echo "=== Backend Directory Structure ==="
echo ""

echo "Root files:"
ls -la *.js *.json 2>/dev/null | awk '{print "  " $NF}'

echo ""
echo "src/ directory:"
find src -type f -name "*.js" | sort | sed 's/^/  /'

echo ""
echo "=== Checking for missing files ==="

files=(
  "server.js"
  "src/app.js"
  "src/config/database.js"
  "src/middleware/logger.js"
  "src/middleware/errorHandler.js"
  "src/routes/auth.js"
  "src/routes/meals.js"
  "src/routes/ingredients.js"
  "src/routes/admin.js"
  "src/routes/users.js"
  "package.json"
  ".env"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ $file (MISSING)"
  fi
done