#!/bin/bash
# Deploy dataset-updater to VPS
# Run from local machine: bash DEPLOY.sh

VPS="root@138.201.62.161"
REMOTE_DIR="/stratbase/apps/webapps/dataset-updater"

echo "=== Deploying dataset-updater to VPS ==="

# 1. Create directory structure on VPS
ssh $VPS "mkdir -p $REMOTE_DIR/updaters $REMOTE_DIR/update_logs"

# 2. Create symlinks (share GDELT venv + bigquery creds)
ssh $VPS "ln -sf ../gdelt-updater/env $REMOTE_DIR/env"
ssh $VPS "ln -sf ../gdelt-updater/bigquery_credentials.json $REMOTE_DIR/bigquery_credentials.json"

# 3. Copy files
scp update_all_datasets.py $VPS:$REMOTE_DIR/
scp .env $VPS:$REMOTE_DIR/
scp updaters/__init__.py updaters/base.py updaters/equipment.py updaters/opensanctions.py updaters/acled.py updaters/viina.py updaters/gdelt.py $VPS:$REMOTE_DIR/updaters/

# 4. Make executable
ssh $VPS "chmod +x $REMOTE_DIR/update_all_datasets.py"

echo ""
echo "=== Deployed! Test with: ==="
echo "  ssh $VPS"
echo "  cd $REMOTE_DIR"
echo "  ./env/bin/python update_all_datasets.py --equipment     # Simplest, test first"
echo "  ./env/bin/python update_all_datasets.py --opensanctions  # Also simple"
echo "  ./env/bin/python update_all_datasets.py --acled          # OAuth API"
echo "  ./env/bin/python update_all_datasets.py --viina          # ZIP download"
echo "  ./env/bin/python update_all_datasets.py --status         # All tables"
echo ""
echo "=== Add cron (after testing): ==="
echo '  crontab -e'
echo '  # Add: 0 9 * * * /stratbase/apps/webapps/dataset-updater/env/bin/python /stratbase/apps/webapps/dataset-updater/update_all_datasets.py >> /stratbase/apps/webapps/dataset-updater/update_logs/cron.log 2>&1'
