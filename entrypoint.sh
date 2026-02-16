#!/bin/sh
set -e

DB_PATH="/app/prisma/data/dev.db"
TEMPLATE_PATH="/app/prisma/template.db"

# Ensure the data directory exists
mkdir -p /app/prisma/data

# Check if the database file is empty (0 bytes) or missing
if [ ! -s "$DB_PATH" ]; then
  echo "⚙️  Database is empty or missing. Initializing from template..."
  cp "$TEMPLATE_PATH" "$DB_PATH"
  echo "✅ Database schema initialized!"

  # Run seed script if it exists
  if [ -f "/app/prisma/seed.js" ]; then
    echo "🌱 Seeding database with default data..."
    node /app/prisma/seed.js
    echo "✅ Database seeded!"
  fi
else
  echo "✅ Database already initialized, skipping setup."
fi

# Start the application
exec node server.js
