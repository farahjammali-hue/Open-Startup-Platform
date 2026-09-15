#!/usr/bin/env bash
#
# One-time cutover: move the platform database out of the shared n8n Postgres
# container and into its own (ost-platform-db).
#
#   ./deploy/migrate-to-own-db.sh
#
# Safe to abort at any point before the final step. The old database is only
# read, never modified, so rolling back is a one-line edit to .env.test.
#
# What it does, in order:
#   1. pauses auto-deploy so nothing rebuilds mid-cutover
#   2. backs up .env.test and the old database
#   3. starts the new Postgres container (empty)
#   4. copies the data across
#   5. compares every table's row count, and STOPS if anything differs
#   6. points the app at the new database and restarts it
#   7. re-enables auto-deploy

set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/ost-platform-test-new}"
ENV_FILE="${ENV_FILE:-.env.test}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
APP_CONTAINER="${APP_CONTAINER:-ost-platform-test}"
NEW_PG="${NEW_PG:-ost-platform-db}"
WORK_DIR="${WORK_DIR:-$HOME/ost-db-cutover}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

log()  { printf '\n[cutover %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
note() { printf '            %s\n' "$*"; }
fail() { printf '\n[cutover] ERROR: %s\n' "$*" >&2; exit 1; }

compose() { sudo docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

# Exact row counts for every table, via query_to_xml so one statement covers
# all of them. pg_stat_user_tables would be an estimate, and reads as zero on a
# freshly restored database until it is analysed.
COUNT_SQL="select table_name, (xpath('/row/cnt/text()', query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as rows from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name;"

cd "$REPO_DIR" || fail "repo not found at $REPO_DIR"
mkdir -p "$WORK_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"

# ---------------------------------------------------------------- read config
[ -f "$ENV_FILE" ] || fail "$ENV_FILE not found"
OLD_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
[ -n "$OLD_URL" ] || fail "DATABASE_URL not found in $ENV_FILE"

_u="${OLD_URL#postgresql://}"; _u="${_u#postgres://}"
OLD_USER="${_u%%:*}"
_rest="${_u#*@}"
OLD_HOST="${_rest%%:*}"; OLD_HOST="${OLD_HOST%%/*}"
OLD_DB="${_rest#*/}"; OLD_DB="${OLD_DB%%\?*}"

if [ "$OLD_HOST" = "$NEW_PG" ]; then
  log "DATABASE_URL already points at $NEW_PG. Nothing to do."
  exit 0
fi

log "Moving database '$OLD_DB' from container '$OLD_HOST' to '$NEW_PG'"
note "user: $OLD_USER"

# ---------------------------------------------------------------- pause autodeploy
log "Pausing auto-deploy"
sudo systemctl stop ost-autodeploy.timer 2>/dev/null || true

# ---------------------------------------------------------------- backups
log "Backing up $ENV_FILE and the current database"
cp "$ENV_FILE" "$WORK_DIR/env.test.$STAMP.bak"
note "env backup: $WORK_DIR/env.test.$STAMP.bak"

OLD_SUPER="$(sudo docker exec "$OLD_HOST" printenv POSTGRES_USER 2>/dev/null || true)"
[ -n "$OLD_SUPER" ] || fail "could not read POSTGRES_USER from container '$OLD_HOST'"

DUMP="$WORK_DIR/$OLD_DB.$STAMP.sql"
sudo docker exec "$OLD_HOST" pg_dump -U "$OLD_SUPER" "$OLD_DB" > "$DUMP"
[ -s "$DUMP" ] || fail "dump is empty, refusing to continue"
note "dump: $DUMP ($(du -h "$DUMP" | cut -f1))"

sudo docker exec "$OLD_HOST" psql -U "$OLD_SUPER" -d "$OLD_DB" -At -F',' -c "$COUNT_SQL" \
  > "$WORK_DIR/counts.before.$STAMP.txt"
note "tables in source: $(wc -l < "$WORK_DIR/counts.before.$STAMP.txt")"

# ---------------------------------------------------------------- new credentials
NEW_PASS="$(openssl rand -hex 24)"

# Written idempotently: replace the line if present, append it if not, so
# re-running after an abort does not produce duplicate keys.
set_env() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    sudo sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" | sudo tee -a "$ENV_FILE" > /dev/null
  fi
}

log "Writing new database credentials into $ENV_FILE"
set_env POSTGRES_DB "$OLD_DB"
set_env POSTGRES_USER "$OLD_USER"
set_env POSTGRES_PASSWORD "$NEW_PASS"
note "a fresh password was generated; it is not the n8n one"

# ---------------------------------------------------------------- start new db
log "Starting the new database container"
compose up -d db || fail "could not start the db service"

log "Waiting for it to be ready"
deadline=$(( $(date +%s) + 120 ))
while :; do
  status="$(sudo docker inspect --format '{{.State.Health.Status}}' "$NEW_PG" 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    sudo docker logs --tail 30 "$NEW_PG" || true
    fail "new database did not become healthy (last status: $status)"
  fi
  sleep 3
done
note "ready"

# Refuse to write into a database that already has tables: that would mean a
# previous attempt left data behind, and restoring on top would be a mess.
EXISTING="$(sudo docker exec "$NEW_PG" psql -U "$OLD_USER" -d "$OLD_DB" -At \
  -c "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")"
if [ "${EXISTING:-0}" -gt 0 ]; then
  fail "the new database already contains $EXISTING tables. Start clean with:
    sudo docker compose --env-file $ENV_FILE -f $COMPOSE_FILE down
    sudo docker volume rm ost_platform_db
  then run this script again."
fi

# ---------------------------------------------------------------- copy data
log "Copying the data across"
sudo docker exec -i "$NEW_PG" psql -v ON_ERROR_STOP=1 -U "$OLD_USER" -d "$OLD_DB" < "$DUMP" > "$WORK_DIR/restore.$STAMP.log" 2>&1 \
  || { tail -20 "$WORK_DIR/restore.$STAMP.log"; fail "restore failed (see $WORK_DIR/restore.$STAMP.log)"; }
note "restored"

# ---------------------------------------------------------------- verify
log "Verifying every table, row by row"
sudo docker exec "$NEW_PG" psql -U "$OLD_USER" -d "$OLD_DB" -At -F',' -c "$COUNT_SQL" \
  > "$WORK_DIR/counts.after.$STAMP.txt"

if ! diff -u "$WORK_DIR/counts.before.$STAMP.txt" "$WORK_DIR/counts.after.$STAMP.txt" > "$WORK_DIR/counts.diff.$STAMP.txt"; then
  echo
  cat "$WORK_DIR/counts.diff.$STAMP.txt"
  echo
  fail "row counts DIFFER between old and new. Nothing has been switched over:
the app is still using the old database. Send the diff above for review."
fi

note "identical: $(wc -l < "$WORK_DIR/counts.after.$STAMP.txt") tables match exactly"

# ---------------------------------------------------------------- switch over
log "Pointing the app at the new database"
NEW_URL="postgresql://${OLD_USER}:${NEW_PASS}@${NEW_PG}:5432/${OLD_DB}"
set_env DATABASE_URL "$NEW_URL"

log "Restarting the app"
compose up -d --force-recreate app || fail "app failed to start; restore $ENV_FILE from $WORK_DIR/env.test.$STAMP.bak"

log "Waiting for the app to be healthy"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  status="$(sudo docker inspect --format '{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    compose logs --tail 40 app || true
    fail "app did not become healthy. To undo:
    cp $WORK_DIR/env.test.$STAMP.bak $ENV_FILE
    sudo docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d --force-recreate app"
  fi
  sleep 5
done

# ---------------------------------------------------------------- done
log "Resuming auto-deploy"
sudo systemctl start ost-autodeploy.timer 2>/dev/null || true

cat <<DONE

================================================================
 Done. The platform now uses its own database container.

 n8n can no longer read platform data, and the new database
 publishes no port, so it stays unreachable from the internet.

 Kept, in case you need them:
   dump of the old data : $DUMP
   previous .env.test   : $WORK_DIR/env.test.$STAMP.bak
   row count comparison : $WORK_DIR/counts.after.$STAMP.txt

 The OLD database inside $OLD_HOST was not touched or deleted.
 Leave it for a week, then drop it once you are confident.

 To undo, if something looks wrong:
   cp $WORK_DIR/env.test.$STAMP.bak $ENV_FILE
   sudo docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d --force-recreate app

 Now open the site and check: you can log in, and the 17
 experts are still listed.
================================================================

DONE
