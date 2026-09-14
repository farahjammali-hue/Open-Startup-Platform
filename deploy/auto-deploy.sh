#!/usr/bin/env bash
#
# Poll origin/main and deploy it when it is new AND its CI run passed.
#
# Pull-based on purpose: nothing inbound is exposed and no credentials leave
# this machine. The repository is public, so CI status is readable without a
# token. If it is ever made private, set GITHUB_TOKEN (read-only) below.
#
# Migrations are gated. If a commit changes the schema or the migration
# script, this refuses to deploy and notifies instead, because migrations can
# delete data and should not run unattended. Deploy those by hand with:
#
#   ./deploy/deploy.sh
#
# Run from the systemd timer in deploy/systemd, or by hand to test.

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/ost-platform-test-new}"
ENV_FILE="${ENV_FILE:-.env.test}"
APP_CONTAINER="${APP_CONTAINER:-ost-platform-test}"
STATE_DIR="${STATE_DIR:-$HOME/.ost-autodeploy}"
NOTIFY_TO="${NOTIFY_TO:-}"          # email address; blank disables email
GITHUB_TOKEN="${GITHUB_TOKEN:-}"    # only needed if the repo becomes private

MIGRATION_PATHS=("server/migrate.mjs" "shared/schema.ts")

mkdir -p "$STATE_DIR"

log() { printf '[autodeploy %s] %s\n' "$(date +'%F %H:%M:%S')" "$*"; }

# Best-effort notification. Never allowed to fail the run: a broken mail setup
# must not stop deploys, and a noisy failure loop helps nobody.
notify() {
  local subject="$1" body="$2"
  log "NOTIFY: $subject"
  [ -n "$NOTIFY_TO" ] || return 0
  # Reuses the app container's own SMTP settings, so no mail credentials are
  # duplicated onto the host.
  # Values are passed as environment variables rather than interpolated into
  # the script: a subject or body containing a quote would otherwise produce
  # invalid JavaScript. The heredoc is quoted so the shell leaves it alone.
  sudo docker exec -i \
    -e "DEPLOY_TO=$NOTIFY_TO" \
    -e "DEPLOY_SUBJECT=$subject" \
    -e "DEPLOY_BODY=$body" \
    "$APP_CONTAINER" node --input-type=commonjs > /dev/null 2>&1 <<'NODE' || true
const nodemailer = require("nodemailer");
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) process.exit(0);
const port = Number(SMTP_PORT) || 587;
nodemailer.createTransport({
  host: SMTP_HOST, port, secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
}).sendMail({
  from: '"Open Startup Deploy" <' + (SMTP_FROM || SMTP_USER) + '>',
  to: process.env.DEPLOY_TO,
  subject: process.env.DEPLOY_SUBJECT,
  text: process.env.DEPLOY_BODY,
}).catch(() => {});
NODE
}

cd "$REPO_DIR" || { log "repo not found at $REPO_DIR"; exit 1; }

git fetch --quiet origin main || { log "fetch failed"; exit 1; }

TARGET="$(git rev-parse origin/main)"
CURRENT="$(git rev-parse HEAD)"

if [ "$TARGET" = "$CURRENT" ]; then
  exit 0   # nothing new; stay quiet so the journal is readable
fi

log "new commit on main: ${TARGET:0:7}"

# ---------------------------------------------------------------- CI gate
SLUG="$(git remote get-url origin | sed -E 's#.*github\.com[:/]##; s#\.git$##')"
AUTH=()
[ -n "$GITHUB_TOKEN" ] && AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")

RUNS="$(curl -sS "${AUTH[@]}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$SLUG/commits/$TARGET/check-runs" || echo '')"

if [ -z "$RUNS" ]; then
  log "could not read CI status; will retry next tick"
  exit 0
fi

# Parsed with grep rather than jq, which is not installed on this host. The
# check-runs payload lists one status/conclusion per run, so counting them is
# sufficient for a pass/fail decision.
TOTAL="$(printf '%s' "$RUNS" | grep -o '"total_count":[0-9]*' | head -1 | cut -d: -f2)"
TOTAL="${TOTAL:-0}"
COMPLETED="$(printf '%s' "$RUNS" | grep -c '"status":"completed"' || true)"
SUCCESS="$(printf '%s' "$RUNS" | grep -c '"conclusion":"success"' || true)"

if [ "$TOTAL" -eq 0 ]; then
  log "no CI runs yet for ${TARGET:0:7}; waiting"
  exit 0
fi
if [ "$COMPLETED" -lt "$TOTAL" ]; then
  log "CI still running ($COMPLETED/$TOTAL complete); waiting"
  exit 0
fi
if [ "$SUCCESS" -lt "$TOTAL" ]; then
  MARKER="$STATE_DIR/failed-$TARGET"
  if [ ! -f "$MARKER" ]; then
    touch "$MARKER"
    notify "Deploy skipped: CI failed on ${TARGET:0:7}" \
"CI did not pass for commit $TARGET on main, so platform-test was not updated.

$SUCCESS of $TOTAL checks succeeded.

https://github.com/$SLUG/commit/$TARGET

The live site is unchanged and still running ${CURRENT:0:7}."
  fi
  log "CI failed ($SUCCESS/$TOTAL passed); not deploying"
  exit 0
fi

log "CI green ($SUCCESS/$TOTAL)"

# ---------------------------------------------------------------- migration gate
if ! git diff --quiet "$CURRENT" "$TARGET" -- "${MIGRATION_PATHS[@]}"; then
  MARKER="$STATE_DIR/blocked-$TARGET"
  if [ ! -f "$MARKER" ]; then
    touch "$MARKER"
    CHANGED="$(git diff --name-only "$CURRENT" "$TARGET" -- "${MIGRATION_PATHS[@]}" | tr '\n' ' ')"
    notify "Deploy blocked: schema change on ${TARGET:0:7}" \
"Commit $TARGET changes the database schema, so it was NOT deployed automatically.

Changed: $CHANGED

Migrations can delete data, so they are applied by hand. Review the diff, then
deploy on the VPS with:

  cd $REPO_DIR && ./deploy/deploy.sh

https://github.com/$SLUG/commit/$TARGET

The live site is unchanged and still running ${CURRENT:0:7}."
  fi
  log "schema change detected; blocked pending manual deploy"
  exit 0
fi

# ---------------------------------------------------------------- deploy
log "deploying ${TARGET:0:7}"
if ./deploy/deploy.sh "$TARGET"; then
  log "deployed ${TARGET:0:7}"
  notify "Deployed ${TARGET:0:7} to platform-test" \
"platform-test.open-startup.org now runs $TARGET.

https://github.com/$SLUG/commit/$TARGET"
else
  log "deploy FAILED for ${TARGET:0:7}"
  notify "Deploy FAILED on ${TARGET:0:7}" \
"Deploying $TARGET to platform-test failed. The script attempted to roll the
code back to ${CURRENT:0:7}.

Check: sudo journalctl -u ost-autodeploy --since '1 hour ago'

https://github.com/$SLUG/commit/$TARGET"
  exit 1
fi
