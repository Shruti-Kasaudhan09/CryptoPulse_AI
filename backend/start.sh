#!/usr/bin/env bash
# start.sh - production entrypoint for the backend container (Phase 22)
#
# Free hosting tiers have ephemeral disks, so on every (re)start the container:
#   1. downloads fresh market data and retrains the models (skipping the heavy
#      LSTM), unless data already exists
#   2. syncs the results into the database (Supabase/PostgreSQL)
#   3. starts the API
# If step 1 fails (e.g. Yahoo Finance is down) the API still starts; the
# dashboard then shows "data not ready" instead of the whole service crashing.

set -u
cd "$(dirname "$0")"
ML_DIR="${CRYPTOPULSE_ML_DIR:-../ml}"

if [ ! -f "$ML_DIR/data/BTC.csv" ] || [ "${REFRESH_ON_START:-1}" = "1" ]; then
  echo ">> Building data + models (this takes a few minutes on first boot)"
  (cd ../ml && python run_pipeline.py --skip-lstm) || echo "!! pipeline failed - starting API anyway"
fi

echo ">> Syncing database"
python -m app.db.sync || echo "!! database sync failed - continuing"

echo ">> Starting API on port ${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers
