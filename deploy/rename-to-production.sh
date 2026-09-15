#!/usr/bin/env bash
#
# ONE-TIME: drop the leftover "test" naming now that this is the production
# deployment (platform.open-startup.org). Renames, in order:
#
#   folder    /home/ubuntu/ost-platform-test-new -> /home/ubuntu/ost-platform
#   env file  .env.test                          -> .env
#   container ost-platform-test                  -> ost-platform
#   database  ost_platform_test                  -> ost_platform
#   db role   ost_test_user                      -> ost_platform_user
#   volume    ost_platform_test_uploads          -> ost_platform_uploads
#
# and repoints the systemd units at the new folder.
#
# The database container is never stopped or touched — only the APP is
# stopped, which is what releases its connections so Postgres can rename the
# database it's holding open. Nothing destructive happens before the
# "point of no return" log line. After that line, the OLD names (folder,
# volume, container) are left in place rather than deleted, so recovery is
# "rename back," not "restore from backup" — except the database/role rename,
# which is genuinely in place, which is why it's backed up first.

set -Eeuo pipefail

OLD_REPO_DIR="${OLD_REPO_DIR:-/home/ubuntu/ost-platform-test-new}"
NEW_REPO_DIR="${NEW_REPO_DIR:-/home/ubuntu/ost-platform}"
OLD_ENV_FILE="${OLD_ENV_FILE:-.env.test}"
NEW_ENV_FILE="${NEW_ENV_FILE:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.yml}"
OLD_APP_CONTAINER="${OLD_APP_CONTAINER:-ost-platform-test}"
NEW_APP_CONTAINER="${NEW_APP_CONTAINER:-ost-platform}"
PG_CONTAINER="${PG_CONTAINER:-ost-platform-db}"
OLD_DB_NAME="${OLD_DB_NAME:-ost_platform_test}"
NEW_DB_NAME="${NEW_DB_NAME:-ost_platform}"
OLD_DB_USER="${OLD_DB_USER:-ost_test_user}"
NEW_DB_USER="${NEW_DB_USER:-ost_platform_user}"
OLD_VOLUME="${OLD_VOLUME:-ost_platform_test_uploads}"
NEW_VOLUME="${NEW_VOLUME:-ost_platform_uploads}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/ost-backups}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

log()  { printf '\n[rename %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
note() { printf '            %s\n' "$*"; }
fail() { printf '\n[rename] ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- guard rails
if [ ! -d "$OLD_REPO_DIR" ]; then
  if [ -d "$NEW_REPO_DIR" ]; then
    log "Already renamed — $NEW_REPO_DIR exists and $OLD_REPO_DIR does not. Nothing to do."
    exit 0
  fi
  fail "neither $OLD_REPO_DIR nor $NEW_REPO_DIR exists — check the path"
fi

cd "$OLD_REPO_DIR" || fail "cannot cd into $OLD_REPO_DIR"

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short
  fail "uncommitted changes in $OLD_REPO_DIR; commit, stash or discard them first"
fi

[ -f "$OLD_ENV_FILE" ] || fail "$OLD_ENV_FILE not found in $OLD_REPO_DIR"

log "Pulling the renamed deploy tooling from origin/main"
git fetch --quiet origin main
git checkout --quiet -B main origin/main

# The pulled docker-compose.yml already expects the NEW names (ost-platform,
# ost_platform_uploads). Confirm that landed before touching anything live.
if ! grep -q "container_name: ost-platform$" "$COMPOSE_FILE"; then
  fail "$COMPOSE_FILE still has the old container name after pulling — \
did the rename commit make it to origin/main?"
fi

# ---------------------------------------------------------------- pause autodeploy
log "Pausing auto-deploy"
sudo systemctl stop ost-autodeploy.timer 2>/dev/null || true

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M%S)"

# ---------------------------------------------------------------- backup first
log "Backing up the database before renaming anything inside it"
PGU="$(sudo docker exec "$PG_CONTAINER" printenv POSTGRES_USER)"
[ -n "$PGU" ] || fail "could not read POSTGRES_USER from $PG_CONTAINER"
BACKUP_FILE="$BACKUP_DIR/${STAMP}_pre-rename_${OLD_DB_NAME}.sql"
sudo docker exec "$PG_CONTAINER" pg_dump -U "$PGU" "$OLD_DB_NAME" > "$BACKUP_FILE"
[ -s "$BACKUP_FILE" ] || fail "backup is empty, refusing to continue"
note "backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Read the current password out of the old env file so the new one is
# generated from it — never invent a new password here, that would silently
# break the app's ability to log in.
CURRENT_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$OLD_ENV_FILE" | head -1 | cut -d= -f2-)"
[ -n "$CURRENT_PASSWORD" ] || fail "POSTGRES_PASSWORD not found in $OLD_ENV_FILE"

echo
echo "================================================================"
echo " About to rename, on this VPS:"
echo "   folder    $OLD_REPO_DIR -> $NEW_REPO_DIR"
echo "   container $OLD_APP_CONTAINER -> $NEW_APP_CONTAINER"
echo "   database  $OLD_DB_NAME -> $NEW_DB_NAME"
echo "   db role   $OLD_DB_USER -> $NEW_DB_USER"
echo "   volume    $OLD_VOLUME -> $NEW_VOLUME (via copy; original kept)"
echo " The database container itself is never stopped — only the app."
echo " Nothing destructive has happened yet. Point of no return is next."
echo "================================================================"
echo
log "Point of no return: stopping the app (database stays up)"

# Only the app is stopped — releasing its connections is what lets Postgres
# rename the database. The db container is never touched.
sudo docker compose --env-file "$OLD_ENV_FILE" -f "$COMPOSE_FILE" stop app || true
sudo docker compose --env-file "$OLD_ENV_FILE" -f "$COMPOSE_FILE" rm -f app || true

# ---------------------------------------------------------------- rename database + role
log "Renaming the database and its role"
# Renaming a database requires no other connections to it, and you can't run
# the rename from a session connected to that same database — hence -d postgres.
if ! sudo docker exec "$PG_CONTAINER" psql -U "$PGU" -d postgres -v ON_ERROR_STOP=1 -c \
  "ALTER DATABASE ${OLD_DB_NAME} RENAME TO ${NEW_DB_NAME};"; then
  fail "database rename failed. Nothing else has changed — the app is stopped \
but the database is exactly as it was. Check for lingering connections with:
    docker exec $PG_CONTAINER psql -U $PGU -d postgres -c \"select pid, usename, application_name from pg_stat_activity where datname = '${OLD_DB_NAME}';\"
  then re-run this script; it is safe to re-run from here."
fi
if ! sudo docker exec "$PG_CONTAINER" psql -U "$PGU" -d postgres -v ON_ERROR_STOP=1 -c \
  "ALTER ROLE ${OLD_DB_USER} RENAME TO ${NEW_DB_USER};"; then
  fail "the database was renamed to ${NEW_DB_NAME} but renaming the role \
${OLD_DB_USER} failed. Do NOT re-run this script — it would try to rename a \
database that no longer has the old name. Instead, rename the role by hand:
    docker exec $PG_CONTAINER psql -U $PGU -d postgres -c \"ALTER ROLE ${OLD_DB_USER} RENAME TO ${NEW_DB_USER};\"
  then re-run this script; it detects the database is already renamed and
  will simply attempt the role rename again (harmlessly, if it already
  succeeded — ALTER ROLE on a role that no longer exists just fails loudly,
  which is fine to ignore in that case)."
fi
note "database and role renamed"

# ---------------------------------------------------------------- copy the uploads volume
log "Copying uploaded files to the new volume name"
sudo docker volume create "$NEW_VOLUME" >/dev/null
OLD_COUNT="$(sudo docker run --rm -v "${OLD_VOLUME}:/from:ro" alpine sh -c 'find /from -type f | wc -l')"
sudo docker run --rm -v "${OLD_VOLUME}:/from:ro" -v "${NEW_VOLUME}:/to" alpine \
  sh -c 'cp -a /from/. /to/'
NEW_COUNT="$(sudo docker run --rm -v "${NEW_VOLUME}:/to:ro" alpine sh -c 'find /to -type f | wc -l')"
if [ "$OLD_COUNT" != "$NEW_COUNT" ]; then
  fail "file count mismatch after copy: old=$OLD_COUNT new=$NEW_COUNT — \
old volume '$OLD_VOLUME' is untouched; investigate before proceeding"
fi
note "copied $NEW_COUNT file(s); old volume '$OLD_VOLUME' left in place untouched"

# ---------------------------------------------------------------- rename the folder + env file
log "Renaming the folder and env file"
cd /home/ubuntu
mv "$OLD_REPO_DIR" "$NEW_REPO_DIR"
cd "$NEW_REPO_DIR"
mv "$OLD_ENV_FILE" "$NEW_ENV_FILE"

# Update the values inside .env to match what was just renamed. Same
# password throughout — nothing is rotated by this script.
sed -i \
  -e "s|^POSTGRES_DB=.*|POSTGRES_DB=${NEW_DB_NAME}|" \
  -e "s|^POSTGRES_USER=.*|POSTGRES_USER=${NEW_DB_USER}|" \
  -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${NEW_DB_USER}:${CURRENT_PASSWORD}@${PG_CONTAINER}:5432/${NEW_DB_NAME}|" \
  "$NEW_ENV_FILE"
note "folder is now $NEW_REPO_DIR, env file is $NEW_ENV_FILE"

# ---------------------------------------------------------------- systemd units
log "Repointing the systemd units at the new folder"
sudo cp deploy/systemd/ost-autodeploy.service /etc/systemd/system/ost-autodeploy.service
sudo cp deploy/systemd/ost-autodeploy.timer /etc/systemd/system/ost-autodeploy.timer
sudo systemctl daemon-reload
note "systemd units updated"

# ---------------------------------------------------------------- bring it up
log "Starting the app under its new name"
sudo docker compose --env-file "$NEW_ENV_FILE" -f "$COMPOSE_FILE" up -d --build app

log "Waiting for it to be healthy"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
while :; do
  status="$(sudo docker inspect --format '{{.State.Health.Status}}' "$NEW_APP_CONTAINER" 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  if [ "$(date +%s)" -ge "$deadline" ]; then
    sudo docker compose --env-file "$NEW_ENV_FILE" -f "$COMPOSE_FILE" logs --tail 40 app || true
    fail "app did not become healthy under the new name. The database was \
already renamed to ${NEW_DB_NAME} (role ${NEW_DB_USER}) — that part is done \
and does not need reversing unless you want to fully roll back. Check the \
logs above; the .env file's DATABASE_URL is the most likely culprit if the \
app can't connect."
  fi
  sleep 5
done
note "healthy"

# ---------------------------------------------------------------- resume autodeploy
log "Resuming auto-deploy"
sudo systemctl start ost-autodeploy.timer 2>/dev/null || true

cat <<DONE

================================================================
 Done. Nothing here says "test" any more.

   folder      $NEW_REPO_DIR
   env file    $NEW_REPO_DIR/$NEW_ENV_FILE
   container   $NEW_APP_CONTAINER
   database    $NEW_DB_NAME  (role: $NEW_DB_USER)
   volume      $NEW_VOLUME

 Kept as a safety net, delete only once you're confident:
   - old uploads volume: docker volume rm $OLD_VOLUME
   - pre-rename database backup: $BACKUP_FILE

 If the database/role rename needs reversing (the one genuinely in-place
 step), run as the Postgres superuser inside $PG_CONTAINER:
   ALTER DATABASE $NEW_DB_NAME RENAME TO $OLD_DB_NAME;
   ALTER ROLE $NEW_DB_USER RENAME TO $OLD_DB_USER;
 then move the folder back to $OLD_REPO_DIR, rename .env back to
 .env.test, and start it with the old docker-compose.yml.

 Now open https://platform.open-startup.org and check: you can log
 in, and the 17 experts are still listed.
================================================================

DONE
