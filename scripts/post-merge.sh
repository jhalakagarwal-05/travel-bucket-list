#!/usr/bin/env bash
set -euo pipefail

# Preserve .replit deployment configuration; this script must not rewrite or remove it.
require_deployment_setting() {
  if ! grep -Fqx "$1" .replit; then
    echo "Missing or changed Autoscale deployment setting in .replit: $1" >&2
    exit 1
  fi
}

require_deployment_setting '[deployment]'
require_deployment_setting 'deploymentTarget = "autoscale"'
require_deployment_setting 'run = ["npm", "run", "start"]'
require_deployment_setting 'build = ["bash", "-lc", "npm ci && npm run build"]'

npm ci --no-audit --no-fund
npm run db:push
npm test
npm run build
