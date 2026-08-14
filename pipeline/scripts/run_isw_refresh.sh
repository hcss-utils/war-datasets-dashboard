#!/usr/bin/env bash
set -euo pipefail
export ISW_RUNTIME_ROOT=/mnt/c/Apps/rubase-scheduler/isw-shapefiles
export ISW_TOKEN_FILE=/home/stephan/.config/rubase/isw-gmail-token.json
export ISW_ENV_FILE=/home/stephan/.config/rubase/isw-refresh.env
export ISW_IMPORTER=/home/stephan/.local/lib/isw-refresh/import_to_server.py
export ISW_DRIVE_ARCHIVE='/mnt/g/My Drive/RuBase/Red lines/Datasets/Control of terrain/attachments'
exec /usr/bin/python3 /home/stephan/.local/lib/isw-refresh/isw_refresh_orchestrator.py

