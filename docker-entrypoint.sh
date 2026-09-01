#!/bin/sh
set -e

npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "RUN_SEED=true — seeding database..."
  npx prisma db seed
fi

exec "$@"
