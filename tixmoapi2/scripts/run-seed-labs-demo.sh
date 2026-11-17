#!/usr/bin/env bash
# Run seed-labs-demo.cjs inside the Railway LABS labs-api container. Labs only; refuses anything else.
#   LOGIN_FILE  demo owner login file: line 1 email (@northlight.example.com), line 2 password. Mode 600. Never printed.
#   RAILWAY_BIN railway CLI 4.40.0 (websocket ssh relay; CLI 5.x needs a registered SSH key)
#   BCRYPTJS    path to a bcryptjs@2.4.3 module on this machine
# The password is hashed here (cost 12); only hashes reach the container. The script file is deleted after the run.
set -euo pipefail
PROJECT=8c5a1df6-dc6b-46ca-a516-dc1c25750921
LABS_ENV=810da028-c2b7-4874-a0d4-e95242dc2cb1
LABS_API=c2ae5f88-7b52-4199-928a-c5d9ee8cc15d
: "${LOGIN_FILE:?set LOGIN_FILE}" "${RAILWAY_BIN:?set RAILWAY_BIN}" "${BCRYPTJS:?set BCRYPTJS}"
[ "$(stat -c %a "$LOGIN_FILE")" = 600 ] || { echo "REFUSED: $LOGIN_FILE must be mode 600" >&2; exit 3; }
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp); chmod 600 "$TMP"; trap 'rm -f "$TMP"' EXIT
LOGIN_FILE="$LOGIN_FILE" BCRYPTJS="$BCRYPTJS" node -e '
const fs=require("fs"),b=require(process.env.BCRYPTJS),c=require("crypto");
const [email,pw]=fs.readFileSync(process.env.LOGIN_FILE,"utf8").split(/\r?\n/);
if(!email.endsWith("@northlight.example.com")||!pw||pw.length<16){console.error("REFUSED: bad login file");process.exit(3)}
const env={DEMO_OWNER_EMAIL:email.trim(),DEMO_OWNER_HASH:b.hashSync(pw,12),DEMO_LOCKED_HASH:b.hashSync(c.randomBytes(32).toString("hex"),12)};
process.stdout.write("Object.assign(process.env,"+JSON.stringify(env)+");\n");' > "$TMP"
cat "$HERE/seed-labs-demo.cjs" >> "$TMP"
B=$(base64 -w0 "$TMP")
"$RAILWAY_BIN" ssh -p "$PROJECT" -e "$LABS_ENV" -s "$LABS_API" -- \
  "sh -c '[ \"\$RAILWAY_ENVIRONMENT_ID\" = $LABS_ENV ] || exit 3; umask 077; echo $B | base64 -d > /app/tmp/seed-labs-demo.cjs && node /app/tmp/seed-labs-demo.cjs; rc=\$?; rm -f /app/tmp/seed-labs-demo.cjs; exit \$rc'"
