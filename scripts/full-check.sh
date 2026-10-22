#!/usr/bin/env bash
# Full verification pipeline. Usage: bash scripts/full-check.sh
set -u
cd "$(dirname "$0")/.."
taskkill //F //IM node.exe >/dev/null 2>&1 || true
sleep 1
echo "== lint =="; npx eslint src prisma scripts tests 2>&1 | tail -5; echo "lint exit: ${PIPESTATUS[0]}"
echo "== typecheck =="; npx tsc --noEmit 2>&1 | tail -5; echo "tsc exit: ${PIPESTATUS[0]}"
echo "== unit =="; npx vitest run --project unit 2>&1 | grep -E "Test Files|Tests |FAIL" 
echo "== integration =="; npx vitest run --project integration 2>&1 | grep -E "Test Files|Tests |FAIL"
echo "== build =="; npm run build 2>&1 | grep -E "rror|✓ Compiled|Failed"
(npx next start -p 3100 > "${TEMP:-/tmp}/start.log" 2>&1 &)
sleep 7
echo "== e2e =="; npx playwright test > /dev/null 2>&1; node scripts/e2e-summary.mjs | cut -c1-1500
echo "== links =="; BASE_URL=http://localhost:3100 npx tsx scripts/check-links.ts 2>&1 | tail -5
