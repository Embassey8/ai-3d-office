#!/usr/bin/env bash
# Rebuild a scratch database from the migrations and run the SQL tests.
# Usage: PGHOST=/var/tmp/pgtest PGPORT=54329 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
P="psql -v ON_ERROR_STOP=1 -q -t -A"
$P -d postgres -c "drop database if exists hq_test" -c "create database hq_test" >/dev/null
P="$P -d hq_test"
$P -f tests/00_supabase_stub.sql 2>/dev/null
for f in migrations/*.sql; do $P -f "$f" >/dev/null; done
out=$($P -f tests/10_rls_and_queue.test.sql 2>&1) || { echo "$out" | grep -E "FAIL|ERROR|DETAIL"; exit 1; }
echo "$out" | grep -c "NOTICE:  ok" | xargs -I{} echo "{} assertions passed"
echo "$out" | grep "ALL TESTS PASSED"
