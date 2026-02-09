#!/usr/bin/env bash
# Step 3 workflow: start API → run Lite test (100 rows) → verify DB → stop API.
# Run from repo root or backend/: cd backend && ./run-step3-workflow.sh
# Uses .env and getConnection() from draw.js. Zero risk to production data.

set -e
cd "$(dirname "$0")"

echo "=============================================="
echo "  Step 3 Workflow (single terminal)"
echo "=============================================="

# 1) Start API server and wait for HTTP 200
echo ""
echo "[1/4] Starting Step 3 API server..."
npm run step3:start &
SERVER_PID=$!
cleanup_server() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  pid=$(lsof -t -i:3000 2>/dev/null) && [ -n "$pid" ] && kill $pid 2>/dev/null || true
}
trap cleanup_server EXIT

echo "      Waiting for http://localhost:3000 to respond (HTTP 200)..."
for i in $(seq 1 30); do
  if code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/draw -X POST 2>/dev/null); then
    if [ "$code" = "200" ]; then
      echo "      API server ready (HTTP 200)."
      break
    fi
  fi
  if [ "$i" -eq 30 ]; then
    echo "      ERROR: Server did not respond with 200 within 30s."
    exit 1
  fi
  sleep 1
done

# 2) Run Step 3 Lite test (100 rows); let it complete fully
echo ""
echo "[2/4] Running Step 3 Lite test (100 rows, all four tests)..."
echo "----------------------------------------------"
if node step3-test-lite.js; then
  LITE_EXIT=0
else
  LITE_EXIT=$?
fi
echo "----------------------------------------------"
echo "      Lite test exit code: $LITE_EXIT"

# 3) Verify DB state (signs count, no temp tables, connections closed by scripts)
echo ""
echo "[3/4] Verifying DB state..."
node step3-verify-db.js

# 4) Final report
echo ""
echo "[4/4] Final report"
echo "=============================================="
if [ "$LITE_EXIT" -eq 0 ]; then
  echo "  Lite tests:      All 4 passed (single draw, 10 sequential, deplete, integrity)"
  echo "  Interruptions:    None"
else
  echo "  Lite tests:       Exit code $LITE_EXIT (check output above)"
  echo "  Interruptions:    Script did not complete successfully"
fi
echo "  DB integrity:     See verification above (signs count, temp tables)"
echo "  Production data:  signs table should show 10,000 rows; signs_backup/signs_test should be absent"
echo "  Connections:      Closed in step3-test-lite.js and step3-verify-db.js finally blocks"
echo "=============================================="
echo ""

exit "$LITE_EXIT"
