#!/usr/bin/env bash
#
# Deploy the platform-test environment from whatever is on origin/main.
#
# Safe to run by hand or from the auto-deploy timer. It backs up the database
# first, applies migrations only when they changed, waits for the container to
# report healthy, and rolls the CODE back if it does not.
#
#   ./deploy/deploy.sh              # deploy origin/main
#   ./deploy/deploy.sh <sha>        # deploy a specific commit
#
# IMPORTANT: rollback restores the previous commit, not the previous database.
# A migration that dropped or deleted data is not undone by rolling back; that
# is what the pre-deploy dump is for.

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/ost-platform-test-new}"
ENV_FILE="${ENV_FILE:-.env.test}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
APP_CONTAINER="${APP_CONTAINER:-ost-platform-test}"
PG_CONTAINER="${PG_CONTAINER:-n8n-postgres}"
DB_NAME="${DB_NAME:-ost_platform_test}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/ost-backups}"
BACKUP_KEEP="${BACKUP_KEEP:-20}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

# Files whose changes mean the database schema must be migrated.
MIGRATION_PATHS=("server/migrate.mjs" "shared/schema.ts")

log()  { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
fail() { printf '[deploy %s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

compose() { sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

cd "$REPO_DIR" || fail "repo not found at $REPO_DIR"

# ---------------------------------------------------------------- resolve target
log "fetching origin"
git fetch --quiet origin main

TARGET="${1:-$(git rev-parse origin/main)}"
CURRENT="$(git rev-parse HEAD)"

if [ "$TARGET" = "$CURRENT" ] && [ "${FORCE:-0}" != "1" ]; then
  log "already at ${CURRENT:0:7}, nothing to do"
  log "(FORCE=1 ./deploy/deploy.sh to rebuild anyway, e.g. after editing .env.test)"
  exit 0
fi

log "deploying ${CURRENT:0:7} -> ${TARGET:0:7}"

# Refuse to clobber uncommitted work on the server. This has bitten us before:
# the compose file was hand-edited on the VPS and existed nowhere else.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short
  fail "uncommitted changes in $REPO_DIR; commit, stash or discard them first"
fi

# ---------------------------------------------------------------- migrations?
NEEDS_MIGRATION=0
if ! git diff --quiet "$CURRENT" "$TARGET" -- "${MIGRATION_PATHS[@]}"; then
  NEEDS_MIGRATION=1
  log "schema/migration changes detected"
fi

# ---------------------------------------------------------------- backup
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/$(date +%Y-%m-%d_%H%M%S)_${CURRENT:0:7}.sql"
log "backing up $DB_NAME"
PGU="$(sudo docker exec "$PG_CONTAINER" printenv POSTGRES_USER)"
[ -n "$PGU" ] || fail "could not read POSTGRES_USER from $PG_CONTAINER"
sudo docker exec "$PG_CONTAINER" pg_dump -U "$PGU" "$DB_NAME" > "$BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || fail "backup is empty, refusing to continue"
log "backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep the most recent N backups so the disk does not fill silently.
ls -1t "$BACKUP_DIR"/*.sql 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm -f

# ---------------------------------------------------------------- checkout
log "checking out ${TARGET:0:7}"
if [ "$TARGET" = "$(git rev-parse origin/main)" ]; then
  # Normal case: stay on the main branch so `git status` and `git pull` behave
  # as expected for anyone poking around on the server afterwards.
  git checkout --quiet -B main "$TARGET"
else
  # Deploying an older or explicit commit: detach rather than dragging the
  # main branch backwards, which would misrepresent what main actually is.
  git checkout --quiet --detach "$TARGET"
fi

rollback() {
  log "ROLLING BACK to ${CURRENT:0:7}"
  git checkout --quiet --detach "$CURRENT" || true
  compose up -d --build app || true
  log "rolled back. NOTE: any migration that already ran was NOT undone."
  log "database backup to restore from if needed: $BACKUP_FILE"
}

# ---------------------------------------------------------------- migrate
if [ "$NEEDS_MIGRATION" = "1" ]; then
  NETWORK="$(grep -E '^POSTGRES_DOCKER_NETWORK=' "$ENV_FILE" | cut -d= -f2-)"
  [ -n "$NETWORK" ] || { rollback; fail "POSTGRES_DOCKER_NETWORK not set in $ENV_FILE"; }

  log "building migration image"
  sudo docker build -q -f deploy/Dockerfile --target build -t ost-test-migrate . >/dev/null \
    || { rollback; fail "migration image build failed"; }

  log "applying migrations"
  # migrate.mjs sends its whole script as one statement, so Postgres wraps it
  # in an implicit transaction: a failure here applies nothing.
  sudo docker run --rm --env-file "$ENV_FILE" --network "$NETWORK" ost-test-migrate npm run db:migrate \
    || { rollback; fail "migration failed (nothing applied)"; }
else
  log "no schema changes, skipping migration"
fi

# ---------------------------------------------------------------- build + start
log "building and starting app"
compose up -d --build app || { rollback; fail "build/start failed"; }

# ---------------------------------------------------------------- health
log "waiting for healthy (timeout ${HEALTH_TIMEOUT}s)"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  status="$(sudo docker inspect --format '{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo missing)"
  case "$status" in
    healthy) log "healthy"; break ;;
    unhealthy) compose logs --tail 40 app || true; rollback; fail "container reported unhealthy" ;;
  esac
  if [ "$(date +%s)" -ge "$deadline" ]; then
    compose logs --tail 40 app || true
    rollback
    fail "timed out waiting for healthy (last status: $status)"
  fi
  sleep 5
done

# ---------------------------------------------------------------- tidy
log "pruning unused images"
sudo docker image prune -f >/dev/null || true

log "deployed ${TARGET:0:7} successfully"
df -h / | tail -1
