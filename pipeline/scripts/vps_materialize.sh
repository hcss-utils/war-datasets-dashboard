#!/usr/bin/env bash
# VPS-side materialisation of the dashboard data.
#
# Runs ON the VPS (where it can reach the war_datasets Postgres on localhost) — the
# GitHub Action can't reach the VPS DB through the Hetzner firewall, which is why the
# PG-backed data kept going stale. This script: sync repo -> export PG to public/data
# JSON -> commit + push -> the deploy.yml Action rebuilds GitHub Pages.
#
# Requires a repo-local, gitignored pipeline/.env with:
#   PG_WARDATASETS_URL=postgresql+psycopg2://USER:PASS@localhost:5432/war_datasets
#   DB_HOST=localhost  DB_PORT=5432  DB_NAME=war_datasets  DB_USER=...  DB_PASSWORD=...
#   EXPORT_OUTPUT_DIR=<repo>/public/data
#   GITHUB_PAT=...        (fine-grained PAT with contents:write on the repo)
#   PYBIN=<repo>/.venv-vps/bin/python
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO"
LOG="$REPO/pipeline/vps_materialize.log"
exec >>"$LOG" 2>&1
echo "===== $(date -u +%FT%TZ) materialize start ====="

set -a; [ -f pipeline/.env ] && . pipeline/.env; set +a
PYBIN="${PYBIN:-$REPO/.venv-vps/bin/python}"
export EXPORT_OUTPUT_DIR="${EXPORT_OUTPUT_DIR:-$REPO/public/data}"

# 1) sync to remote (data + code); untracked .env / .venv-vps survive a hard reset
git fetch origin main --quiet && git reset --hard origin/main --quiet

# 2) materialise the territory data PG -> JSON (self-contained: scalar series +
#    geojson + correspondence + metadata date-range). The full export_all_dashboard_data.py
#    (other datasets, in schemas this DB may not match) stays the GitHub Action's job.
"$PYBIN" pipeline/scripts/gen_territory_extras.py || echo "WARN: gen_territory_extras failed"

# 3) commit + push only data changes (redact any token from output)
git add public/data
if git diff --staged --quiet; then
  echo "no data changes"
else
  git -c user.name="vps-materialize[bot]" -c user.email="vps-materialize@hcss" \
      commit -q -m "chore: materialize dashboard data $(date -u +%F)"
  git -c credential.helper='!f(){ echo username=x-access-token; echo "password=$GITHUB_PAT"; };f' \
      push origin main 2>&1 | sed -E 's#ghp_[A-Za-z0-9_]+#ghp_***#g; s#github_pat_[A-Za-z0-9_]+#github_pat_***#g'
  echo "pushed $(git rev-parse --short HEAD)"
fi
echo "===== $(date -u +%FT%TZ) done ====="
