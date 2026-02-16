#!/bin/sh
set -e

DB_PATH="/app/prisma/data/dev.db"
TEMPLATE_PATH="/app/prisma/template.db"

# Fix ownership of the data directory (we start as root)
chown -R nextjs:nodejs /app/prisma/data

# Check if the database file is empty (0 bytes) or missing
if [ ! -s "$DB_PATH" ]; then
  echo "⚙️  Database is empty or missing. Initializing from template..."
  cp "$TEMPLATE_PATH" "$DB_PATH"
  chown nextjs:nodejs "$DB_PATH"
  echo "✅ Database schema initialized!"

  # Run seed script if it exists
  if [ -f "/app/prisma/seed.js" ]; then
    echo "🌱 Seeding database with default data..."
    su-exec nextjs node /app/prisma/seed.js
    echo "✅ Database seeded!"
  fi
else
  echo "✅ Database already initialized, skipping setup."
fi

# Drop privileges and start the application as nextjs user
exec su-exec nextjs node server.js
