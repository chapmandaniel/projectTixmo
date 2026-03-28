#!/bin/sh
set -eu

api_url="${VITE_API_URL:-/api/v1}"
escaped_api_url=$(printf '%s' "$api_url" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat >/usr/share/nginx/html/runtime-config.js <<EOF
window.__TIXMO_CONFIG__ = Object.assign({}, window.__TIXMO_CONFIG__, {
  apiUrl: "${escaped_api_url}"
});
EOF
