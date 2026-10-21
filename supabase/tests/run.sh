#!/usr/bin/env bash
# Teste les migrations sur un PostgreSQL local (15+), sans Supabase.
# Usage : bash supabase/tests/run.sh   (variable PSQL pour changer la commande, ex. PSQL="psql -U postgres -h localhost")
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
$PSQL -q -d postgres -c 'drop database if exists nabd_test' -c 'create database nabd_test'
cat tests/00_supabase_stub.sql migrations/*.sql | $PSQL -q -v ON_ERROR_STOP=1 -d nabd_test > /dev/null
$PSQL -q -o /dev/null -d nabd_test < tests/10_roles_test.sql 2>&1 | grep -E "ok -|ÉCHEC|ERROR|passés" | sed 's/^.*NOTICE: *//'
