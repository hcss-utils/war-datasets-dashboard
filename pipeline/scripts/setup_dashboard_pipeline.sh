#!/bin/bash
# =============================================================================
# VPS Dashboard Pipeline Setup
# Creates SQL views, loads missing data, deploys dataset-updater,
# sets up Node.js, dashboard export, and cron jobs.
# Run this ONCE from local machine.
# =============================================================================
set -e

VPS_HOST="${VPS_HOST:?Set VPS_HOST}"
VPS_USER="${VPS_USER:-root}"
VPS_PASS="${VPS_PASS:?Set VPS_PASS}"
DB_PASS="${DB_PASS:?Set DB_PASS}"
PIPELINE_DIR="/stratbase/apps/webapps/dashboard-pipeline"

SSH="sshpass -p '$VPS_PASS' ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
SCP="sshpass -p '$VPS_PASS' scp -o StrictHostKeyChecking=no"

echo "=== Step 1: Create directory structure on VPS ==="
eval $SSH "mkdir -p ${PIPELINE_DIR}/{scripts,data,logs,dashboard}"

echo ""
echo "=== Step 2: SQL migration — create views and missing tables ==="
eval $SSH "PGPASSWORD=${DB_PASS} psql -h localhost -U postgres -d war_datasets" << 'EOSQL'

-- 2a: Create isw.clean_daily_areas view for territory export
CREATE OR REPLACE VIEW isw.clean_daily_areas AS
SELECT layer_date, layer_type, conflict, area_km2, change_km2, change_pct
FROM public.daily_territory_area;

-- 2b: Add gdp_share column to SIPRI if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='economic_data' AND table_name='sipri_military_expenditure'
      AND column_name='military_expenditure_gdp_share'
  ) THEN
    ALTER TABLE economic_data.sipri_military_expenditure
      ADD COLUMN military_expenditure_gdp_share NUMERIC;
  END IF;
END $$;

-- 2c: Create world_bank_gdp table if missing
CREATE TABLE IF NOT EXISTS economic_data.world_bank_gdp (
  country TEXT NOT NULL,
  year INTEGER NOT NULL,
  gdp_current_usd NUMERIC,
  iso3 TEXT,
  PRIMARY KEY (country, year)
);

-- Verify
SELECT 'isw.clean_daily_areas' as obj, COUNT(*) FROM isw.clean_daily_areas;
SELECT 'sipri gdp_share column' as obj,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='economic_data' AND table_name='sipri_military_expenditure'
      AND column_name='military_expenditure_gdp_share'
  ) THEN 'EXISTS' ELSE 'MISSING' END as status;
SELECT 'economic_data.world_bank_gdp' as obj, COUNT(*) FROM economic_data.world_bank_gdp;

EOSQL

echo ""
echo "=== Step 3: Load World Bank GDP data from local ==="
echo "(Exporting from local DB, uploading to VPS)"

# Export world_bank_gdp from local Docker DB to CSV
docker exec russian-ukrainian-war psql -U isw -d russian_ukrainian_war -c \
  "COPY (SELECT country, year, gdp_current_usd, iso3 FROM economic_data.world_bank_gdp ORDER BY country, year) TO STDOUT WITH CSV HEADER" \
  > /tmp/world_bank_gdp.csv

echo "  Exported $(wc -l < /tmp/world_bank_gdp.csv) rows to CSV"

# Upload and load
eval $SCP /tmp/world_bank_gdp.csv ${VPS_USER}@${VPS_HOST}:/tmp/world_bank_gdp.csv
eval $SSH "PGPASSWORD=${DB_PASS} psql -h localhost -U postgres -d war_datasets -c \"
  TRUNCATE economic_data.world_bank_gdp;
  COPY economic_data.world_bank_gdp(country, year, gdp_current_usd, iso3)
    FROM '/tmp/world_bank_gdp.csv' WITH CSV HEADER;
  SELECT COUNT(*) as loaded FROM economic_data.world_bank_gdp;
\""

echo ""
echo "=== Step 4: Load SIPRI GDP share data from local ==="
docker exec russian-ukrainian-war psql -U isw -d russian_ukrainian_war -c \
  "COPY (SELECT country, year, military_expenditure_gdp_share FROM economic_data.sipri_military_expenditure WHERE military_expenditure_gdp_share IS NOT NULL) TO STDOUT WITH CSV HEADER" \
  > /tmp/sipri_gdp_share.csv

echo "  Exported $(wc -l < /tmp/sipri_gdp_share.csv) SIPRI GDP share rows"

eval $SCP /tmp/sipri_gdp_share.csv ${VPS_USER}@${VPS_HOST}:/tmp/sipri_gdp_share.csv
eval $SSH "PGPASSWORD=${DB_PASS} psql -h localhost -U postgres -d war_datasets" << 'EOSQL2'
-- Load into temp table and update
CREATE TEMP TABLE sipri_gdp_tmp (country TEXT, year INT, gdp_share NUMERIC);
COPY sipri_gdp_tmp FROM '/tmp/sipri_gdp_share.csv' WITH CSV HEADER;
UPDATE economic_data.sipri_military_expenditure s
SET military_expenditure_gdp_share = t.gdp_share
FROM sipri_gdp_tmp t
WHERE s.country = t.country AND s.year = t.year;
SELECT COUNT(*) as updated FROM economic_data.sipri_military_expenditure WHERE military_expenditure_gdp_share IS NOT NULL;
EOSQL2

echo ""
echo "=== Step 5: Deploy dataset-updater ==="
UPDATER_DIR="/stratbase/apps/webapps/dataset-updater"
eval $SSH "mkdir -p ${UPDATER_DIR}/updaters ${UPDATER_DIR}/update_logs"

# Copy all files
UPDATER_LOCAL="/mnt/g/My Drive/RuBase/Red lines/VPS/dataset-updater"
eval $SCP "'${UPDATER_LOCAL}/update_all_datasets.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/
eval $SCP "'${UPDATER_LOCAL}/.env'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/
eval $SCP "'${UPDATER_LOCAL}/updaters/base.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/updaters/
eval $SCP "'${UPDATER_LOCAL}/updaters/__init__.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/updaters/
eval $SCP "'${UPDATER_LOCAL}/updaters/equipment.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/updaters/
eval $SCP "'${UPDATER_LOCAL}/updaters/opensanctions.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/updaters/
eval $SCP "'${UPDATER_LOCAL}/updaters/acled.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/updaters/
eval $SCP "'${UPDATER_LOCAL}/updaters/viina.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/updaters/
eval $SCP "'${UPDATER_LOCAL}/updaters/gdelt.py'" ${VPS_USER}@${VPS_HOST}:${UPDATER_DIR}/updaters/

# Symlink to GDELT venv (shared)
eval $SSH "ln -sf /stratbase/apps/webapps/gdelt-updater/env ${UPDATER_DIR}/env 2>/dev/null || true"
eval $SSH "chmod +x ${UPDATER_DIR}/update_all_datasets.py"

echo ""
echo "=== Step 6: Deploy export script ==="
eval $SCP "'$(dirname "$0")/../Datasets/export_all_dashboard_data.py'" ${VPS_USER}@${VPS_HOST}:${PIPELINE_DIR}/scripts/

echo ""
echo "=== Step 7: Install Node.js if needed ==="
eval $SSH "which node > /dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs)"
eval $SSH "node --version && npm --version"

echo ""
echo "=== Step 8: Clone/update dashboard repo ==="
eval $SSH "cd ${PIPELINE_DIR}/dashboard && git pull 2>/dev/null || git clone https://github.com/sdspieg/war-datasets-dashboard.git ${PIPELINE_DIR}/dashboard"
eval $SSH "cd ${PIPELINE_DIR}/dashboard && npm install --production=false"

echo ""
echo "=== Step 9: Copy static CSV-based JSON files ==="
# These are from static/infrequently-updated CSV sources (Oryx, UkrDailyUpdate, Kaggle, KIU)
# Just copy the current JSON outputs so they don't need to be regenerated
STATIC_FILES=(
  "oryx_equipment_daily.json"
  "oryx_by_category.json"
  "ukrdailyupdate_by_type.json"
  "ukrdailyupdate_incidents.json"
  "kaggle_missile_daily.json"
  "kaggle_missile_weapons.json"
  "kiu_officers_summary.json"
  "petroivaniuk_equipment_daily.json"
  "petroivaniuk_personnel_daily.json"
)
DATA_SRC="/mnt/g/My Drive/RuBase/Red lines/Datasets/dashboard/public/data"
eval $SSH "mkdir -p ${PIPELINE_DIR}/data/static"
for f in "${STATIC_FILES[@]}"; do
  if [ -f "${DATA_SRC}/${f}" ]; then
    eval $SCP "'${DATA_SRC}/${f}'" ${VPS_USER}@${VPS_HOST}:${PIPELINE_DIR}/data/static/
    echo "  Copied ${f}"
  fi
done

echo ""
echo "=== Step 10: Create master pipeline script ==="
eval $SSH "cat > ${PIPELINE_DIR}/run_dashboard_pipeline.sh" << 'PIPELINE_EOF'
#!/bin/bash
# =============================================================================
# Dashboard Pipeline — runs daily after dataset-updater and GDELT crons
# 1. Updates datasets (equipment, personnel, acled, viina, opensanctions)
# 2. Exports all data to JSON
# 3. Builds dashboard
# 4. Deploys to GitHub Pages
# =============================================================================
set -e
PIPELINE_DIR="/stratbase/apps/webapps/dashboard-pipeline"
UPDATER_DIR="/stratbase/apps/webapps/dataset-updater"
LOG_DIR="${PIPELINE_DIR}/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG="${LOG_DIR}/pipeline_${TIMESTAMP}.log"

exec > >(tee -a "$LOG") 2>&1

echo "=== Dashboard Pipeline Started: $(date) ==="

# --- Step 1: Run dataset updaters (incremental) ---
echo ""
echo "--- Step 1: Running dataset updaters ---"
cd "${UPDATER_DIR}"
export PATH="/root/.local/bin:$PATH"

# Use the GDELT venv which has psycopg2 + pandas
PYTHON="${UPDATER_DIR}/env/bin/python"

if [ -f "${UPDATER_DIR}/update_all_datasets.py" ]; then
  ${PYTHON} update_all_datasets.py 2>&1 || echo "WARNING: dataset-updater had errors (continuing)"
else
  echo "WARNING: dataset-updater not found, skipping"
fi

# --- Step 2: Refresh territory materialized view ---
echo ""
echo "--- Step 2: Refreshing territory materialized view ---"
PGPASSWORD=\${DB_PASS} psql -h localhost -U postgres -d war_datasets -c \
  "REFRESH MATERIALIZED VIEW public.daily_territory_area;" 2>&1 || echo "WARNING: matview refresh failed"

# --- Step 3: Export dashboard JSON ---
echo ""
echo "--- Step 3: Exporting dashboard data ---"
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=war_datasets
export DB_USER=postgres
export DB_PASSWORD=\${DB_PASS}
export EXPORT_OUTPUT_DIR="${PIPELINE_DIR}/data/export"

mkdir -p "${EXPORT_OUTPUT_DIR}"
cd "${PIPELINE_DIR}/scripts"
${PYTHON} export_all_dashboard_data.py 2>&1

# --- Step 4: Merge static + exported JSON files ---
echo ""
echo "--- Step 4: Merging data files ---"
FINAL_DATA="${PIPELINE_DIR}/dashboard/public/data"
mkdir -p "${FINAL_DATA}"

# Copy static files first (CSV-based, not regenerated)
cp -n ${PIPELINE_DIR}/data/static/*.json "${FINAL_DATA}/" 2>/dev/null || true

# Copy freshly exported files (overwrites stale copies)
cp ${EXPORT_OUTPUT_DIR}/*.json "${FINAL_DATA}/" 2>/dev/null || true

echo "  Data files: $(ls ${FINAL_DATA}/*.json 2>/dev/null | wc -l) JSON files"

# --- Step 5: Build dashboard ---
echo ""
echo "--- Step 5: Building dashboard ---"
cd "${PIPELINE_DIR}/dashboard"
git pull --ff-only 2>/dev/null || true
export VITE_BUILD_TS=$(date +%s)
npx tsc && npx vite build

# --- Step 6: Deploy to GitHub Pages ---
echo ""
echo "--- Step 6: Deploying to GitHub Pages ---"
# Copy data into dist
cp -r "${FINAL_DATA}" "${PIPELINE_DIR}/dashboard/dist/data"

# Configure git for deploy
cd "${PIPELINE_DIR}/dashboard"
git config user.email "pipeline@vps.local"
git config user.name "VPS Pipeline"

# Get GitHub token
GH_TOKEN=$(cat /stratbase/apps/webapps/red-lines-database/.gh_token 2>/dev/null || echo "")
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: No GitHub token found, cannot deploy"
  exit 1
fi

# Deploy via gh-pages
REPO_URL="https://${GH_TOKEN}@github.com/sdspieg/war-datasets-dashboard.git"
npx gh-pages -d dist -r "${REPO_URL}" --dotfiles 2>&1

echo ""
echo "=== Dashboard Pipeline Complete: $(date) ==="

# Cleanup old logs (keep last 30)
ls -t ${LOG_DIR}/pipeline_*.log | tail -n +31 | xargs rm -f 2>/dev/null || true
PIPELINE_EOF

eval $SSH "chmod +x ${PIPELINE_DIR}/run_dashboard_pipeline.sh"

echo ""
echo "=== Step 11: Install gh-pages npm package ==="
eval $SSH "cd ${PIPELINE_DIR}/dashboard && npm install gh-pages --save-dev 2>/dev/null || npm install gh-pages"

echo ""
echo "=== Step 12: Set up cron job ==="
# Add cron: 10:00 UTC daily (after GDELT at 06:00-08:00 and dataset-updater at 09:00)
CRON_LINE="0 10 * * * ${PIPELINE_DIR}/run_dashboard_pipeline.sh >> ${PIPELINE_DIR}/logs/cron.log 2>&1"
eval $SSH "crontab -l 2>/dev/null | grep -v 'run_dashboard_pipeline' | { cat; echo '${CRON_LINE}'; } | crontab -"

echo ""
echo "=== Setup Complete ==="
echo "Pipeline directory: ${PIPELINE_DIR}"
echo "Cron: daily at 10:00 UTC"
echo ""
echo "To test: ssh root@${VPS_HOST} '${PIPELINE_DIR}/run_dashboard_pipeline.sh'"
