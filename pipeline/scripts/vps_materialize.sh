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
"$PYBIN" pipeline/scripts/gen_territory_methodology.py || echo "WARN: gen_territory_methodology failed"
"$PYBIN" pipeline/scripts/refresh_territory_harmonisation.py || echo "WARN: refresh_territory_harmonisation failed"
"$PYBIN" pipeline/scripts/gen_territory_harmonisation.py || echo "WARN: gen_territory_harmonisation failed"

# 2b) refresh aerial data from Kaggle + re-export the 2 aerial datasets, so the Aerial Assaults
#     tab + weapons chart stay fresh (they went empty when the kaggle CLI was missing here, 2026-06-19).
#     Requires kaggle + pandas in .venv-vps and /root/.kaggle/kaggle.json (both provisioned 2026-06-19).
( cd pipeline && PATH="$REPO/.venv-vps/bin:$PATH" KAGGLE_CONFIG_DIR="${KAGGLE_CONFIG_DIR:-/root/.kaggle}" \
    "$PYBIN" update_all_datasets.py --missiles ) || echo "WARN: missiles update failed"
EXPORT_OUTPUT_DIR="$REPO/public/data" "$PYBIN" -c "
import sys; sys.path.insert(0,'pipeline/scripts')
import export_all_dashboard_data as e
c=e.get_connection(); e.export_daily_aerial_threats(c); e.export_weapon_types(c); c.close()
print('aerial export ok')
" || echo "WARN: aerial export failed"

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

# 4) build + deploy to the VPS webapp dir so rubase.org/war-datasets-dashboard/ AUTO-REFRESHES
#    (the house pattern — not just gh-pages, which the push above triggers). Self-contained app:
#    dist/ includes data/, so a --delete rsync is safe (no external media dirs like the overview app).
WEBROOT=/stratbase/apps/webapps/war-datasets-dashboard
if command -v npm >/dev/null 2>&1 && [ -n "$WEBROOT" ] && [ -d "$WEBROOT" ]; then
  [ -d node_modules ] || npm ci --legacy-peer-deps >/dev/null 2>&1 || echo "WARN: npm ci failed"
  if npm run build >/tmp/wardash_vps_build.log 2>&1; then
    rsync -a --delete dist/ "$WEBROOT/" && echo "deployed to rubase.org webapp ($WEBROOT)"
  else
    echo "WARN: vite build failed — rubase.org webapp NOT updated"; tail -5 /tmp/wardash_vps_build.log
  fi
else
  echo "WARN: npm or $WEBROOT missing — skipped rubase.org webapp deploy"
fi
echo "===== $(date -u +%FT%TZ) done ====="
