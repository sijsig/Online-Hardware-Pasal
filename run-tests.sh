#!/bin/bash
set -e
cd /Users/sijansigdel/Documents/Codex/OHP/OHP

echo "========================================="
echo "OHP Full Test Runner"
echo "========================================="

echo "[1/6] Checking .env.local..."
cat .env.local
echo ""

echo "[2/6] Testing Supabase..."
ANON_KEY="sb_publishable_vFaShJhg6LrKlLb0mWKh0Q_4blyjhxf"
curl -s -H "apikey: $ANON_KEY" \
  "https://hhavjnfgedskwomdbpsj.supabase.co/rest/v1/profiles?select=id,role,full_name&limit=5" | jq . || exit 1
echo "✅ Supabase OK"

echo "[3/6] Starting dev server on 8888..."
lsof -ti :8888 | xargs kill -9 2>/dev/null || true
npm run dev > dev-server.log 2>&1 &
DEV_PID=$!

for i in {1..60}; do
  grep -q "Ready in" dev-server.log && break
  grep -qi "error\|failed\|ECONNREFUSED\|500" dev-server.log && { echo "❌ Dev server error:"; grep -i "error\|failed\|ECONNREFUSED\|500" dev-server.log; kill $DEV_PID; exit 1; }
  sleep 1
done
echo "✅ Dev server ready (PID: $DEV_PID)"

echo "[4/6] Testing login API on 8888..."
curl -s -X POST http://localhost:8888/api/mobile/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"TestPass123!"}' | grep -q '"success":true' || { echo "❌ API failed"; cat dev-server.log; kill $DEV_PID; exit 1; }
echo "✅ Login API works"

echo "[5/6] Running tests..."
npm test
TEST_EXIT=$?

kill $DEV_PID 2>/dev/null || true
echo ""
echo "========================================="
[ $TEST_EXIT -eq 0 ] && echo "✅ ALL TESTS PASSED!" || echo "❌ TESTS FAILED (code: $TEST_EXIT)"
echo "========================================="
exit $TEST_EXIT
