#!/bin/sh
set -e

# Apply migrations before the app accepts traffic. Safe to run on every boot.
echo "[entrypoint] applying database migrations…"
npx prisma migrate deploy

exec "$@"
