# Deploying platform.open-startup.org — technical runbook

This is the step-by-step command reference for whoever actually runs the
deployment (you, or a developer you hand this to). For the plain-language
overview, see the deployment-readiness report shared alongside this.

All commands below assume you're SSH'd into the VPS, in the repo's root
directory, and that Docker, Docker Compose, and CloudPanel are already set up
(per the brief — nothing here installs or reconfigures those).

---

## 0. Before you start

Check off each of these (see the report's "Decisions & credentials needed"
section for how to get each one):

- [ ] DNS: `platform.open-startup.org` points at this VPS's IP address
- [ ] Basic Auth is optional (step 7) — access control comes from the signup
      approval flow now
- [ ] You know which teammate emails should be admins (`ADMIN_EMAILS`)
- [ ] You've decided whether to enable Google login / email / captcha, or
      leave them off for now
- [ ] You've picked a password for the platform's own database
      (`POSTGRES_PASSWORD`); `openssl rand -hex 24` generates a good one

---

## 1. Get the code onto the VPS

```bash
git clone <your-repo-url> ost-platform
cd ost-platform
```

(Or `rsync`/`scp` the project folder if it's not in git yet. Either way, end
up with the project at some path like `/home/<user>/ost-platform`.)

## 2. The database

Nothing to do here. `docker-compose.yml` runs PostgreSQL itself, in a
container dedicated to this platform (`ost-platform-db`) with its own volume
and its own superuser. It is created on first start from `POSTGRES_DB`,
`POSTGRES_USER` and `POSTGRES_PASSWORD` in `.env` (step 3).

It shares nothing with any other service on this VPS. That is deliberate: the
platform database previously lived inside the n8n Postgres container, where
n8n's superuser could read every row of it, including cap tables and KYS
documents.

It publishes no port, so it is reachable only from the private compose
network. Not from the internet, and not from the host. To open a shell on it:

```bash
docker exec -it ost-platform-db psql -U ost_platform_user -d ost_platform
```

Those three `POSTGRES_*` values only take effect the first time the volume is
created. Changing `POSTGRES_PASSWORD` later does NOT change the password in an
existing database; you have to `ALTER USER` inside it.

## 3. Configure the environment

```bash
cp deploy/.env.example .env
nano .env   # fill in POSTGRES_PASSWORD, DATABASE_URL (same password),
                  # SESSION_SECRET, and ADMIN_EMAILS at minimum
```

Generate a session secret:

```bash
openssl rand -hex 32
```

## 4. Build the image

```bash
docker compose --env-file .env -f deploy/docker-compose.yml build
```

## 5. Create the database schema (one-time, or after a schema change)

The production image intentionally excludes dev tools (like drizzle-kit) and
`server/migrate.mjs`, so schema work runs from the earlier "build" stage
instead. These are plain `docker run` commands rather than compose, so they join the
deployment's private network explicitly. The database must already be running
(`docker compose --env-file .env -f deploy/docker-compose.yml up -d db`).

```bash
docker build -f deploy/Dockerfile --target build -t ost-platform-migrate .
docker run --rm --env-file .env \
  --network ost_platform_internal \
  ost-platform-migrate npm run db:push
docker run --rm --env-file .env \
  --network ost_platform_internal \
  ost-platform-migrate npm run db:migrate
```

`db:push` creates all tables (including the `session` table) from
`shared/schema.ts`. `db:migrate` then applies the incremental `ALTER`
statements in `server/migrate.mjs` on top. Run BOTH: the two are kept in
sync by hand and each covers changes the other doesn't. Both are idempotent
and safe to re-run.

Optional: seed the built-in Open Startup School catalogue and starter office
hours slots:

```bash
docker run --rm --env-file .env \
  --network ost_platform_internal \
  ost-platform-migrate npm run db:seed
```

## 6. Start the app

```bash
docker compose --env-file .env -f deploy/docker-compose.yml up -d
docker compose --env-file .env -f deploy/docker-compose.yml logs -f app   # watch it boot; Ctrl+C to stop watching
```

You should see `OST All-in-One running at http://localhost:5000` in the logs.
The container only listens on `127.0.0.1:5100` on the host — nothing public
yet. That's expected; CloudPanel handles the public side next.

## 7. Set up the site in CloudPanel

1. **Sites → Add Site → Reverse Proxy** (not "Node.js" — we're managing the
   app ourselves via Docker Compose, so a plain reverse proxy is simplest and
   least likely to conflict with anything CloudPanel auto-manages).
2. Domain: `platform.open-startup.org`
3. Reverse proxy target: `http://127.0.0.1:5100`
4. Save, then go to the site's **SSL/HTTPS** tab → enable **Let's Encrypt** →
   issue the certificate. CloudPanel handles the Nginx config and renewal.
5. **Basic Auth** (optional): a shared password gate in front of the whole
   site. Access control now comes from the signup approval flow instead (new
   accounts can't do anything until an admin approves them), so this is no
   longer required — only turn it on if you want an extra layer in front of
   the login page itself. In the site's settings, find **Basic Auth**
   (sometimes under a "Security" or "Tools" tab depending on your CloudPanel
   version) → enable it → set a username/password. Share that password with
   teammates out-of-band (Slack DM, not email).

   If your CloudPanel version doesn't expose a Basic Auth toggle, the
   equivalent manual step is adding to the site's Nginx vhost (CloudPanel
   usually gives you a "Vhost" edit box for exactly this):

   ```nginx
   location / {
       auth_basic           "Open Startup Platform";
       auth_basic_user_file /etc/nginx/.htpasswd-platform;
       proxy_pass           http://127.0.0.1:5100;
       proxy_set_header     Host $host;
       proxy_set_header     X-Real-IP $remote_addr;
       proxy_set_header     X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header     X-Forwarded-Proto $scheme;
   }
   ```

   Generate the password file once:
   ```bash
   sudo htpasswd -c /etc/nginx/.htpasswd-platform teamuser
   ```

6. Visit `https://platform.open-startup.org` — you should reach the app's
   login screen (or the Basic Auth prompt first, if you turned that on).

## 8. Smoke test

- [ ] If Basic Auth is on, its prompt appears before anything else loads
- [ ] Sign up a test account — if SMTP isn't configured, the verification
      link appears in `docker compose --env-file .env -f deploy/docker-compose.yml logs app`
- [ ] One of the `ADMIN_EMAILS` accounts sees the admin dashboard after login
- [ ] Upload a small file (e.g. a logo) somewhere and confirm it appears —
      confirms the uploads volume is writable
- [ ] Confirm `https://` (padlock) is present — cookies won't work over plain
      `http://` in production mode

---

## Calendar invites for sessions

The platform creates the Zoom meeting and shows founders the join link, but it
does not touch anyone's calendar unless you turn one of these on. There are
three ways to do it and you should run exactly ONE, because each creates its
own calendar entry:

**1. Emailed iCalendar invites (recommended).** Set `CALENDAR_INVITES=ics` in
`.env` and make sure the SMTP settings are filled in. An update or
cancellation goes out whenever the session changes.

Who receives it depends on the session type. A Mentorship session belongs to
one startup, so only that startup's user is invited: inviting the cohort would
disclose who is being mentored and when. Training has no startup, so every
active verified founder is invited. Admins and the session's Zoom host are
included either way, admins on purpose, so the person scheduling a session
sees it in their own calendar. No Google setup or admin consent needed.

The invite's ORGANIZER is set from `SMTP_FROM`, which must match the account
the mail is actually sent from. Gmail and Outlook only honour an invite when
those agree; if they diverge, the invite silently arrives as a plain file
attachment instead. Replies (accept/decline) go to that address.
One message is sent per recipient, so founders never see each other's
addresses. If SMTP is unset, invites are written to the container logs instead
of emailed, which is useful for checking the content before going live.

**2. Zoom's own calendar sync.** No code and nothing to deploy: connect each
Zoom host account to its Google Calendar in Zoom's own settings. The catch is
that the event lands on the host account's calendar rather than on each
participant's, so founders get nothing. Leave `CALENDAR_INVITES=off` if you
rely on this.

**3. Google Calendar API.** Not built yet. It would create real Google
Calendar events with founders as invitees and propagate edits automatically,
but it needs a Google Cloud service account with the Calendar scope plus
domain-wide delegation across the Workspace, which is an admin and security
decision rather than just a code change.

Session times are stored as `timestamp without time zone` and the container
runs UTC, so invite times are correct as long as you do not set `TZ` on the
container. If you ever do, existing sessions will appear to shift.

---

## Redeploying after a code change

```bash
cd /home/ubuntu/ost-platform && ./deploy/deploy.sh
```

That is the whole thing. The script dumps the database, pulls `origin/main`,
applies migrations only if `shared/schema.ts` or `server/migrate.mjs` changed,
rebuilds, waits for the container to report healthy, and prunes old images. If
the container does not come up healthy it puts the previous commit back.

It refuses to run if the working tree is dirty, which is deliberate: the
compose file was once hand-edited on the server and existed nowhere else, and
a silent checkout would have destroyed it.

**Rollback restores the code, not the database.** A migration that deleted or
dropped something is not undone by rolling back. That is what the pre-deploy
dump in `~/ost-backups` is for; the twenty most recent are kept.

To deploy a specific commit rather than the tip of `main`:

```bash
./deploy/deploy.sh <sha>
```

---

## Moving off the shared n8n database (one time)

Earlier deployments kept the platform's tables inside the n8n Postgres
container. That gave n8n's superuser read access to everything here, including
cap tables and KYS documents, and tied the two services to one container's
lifecycle.

`deploy/migrate-to-own-db.sh` performs the cutover:

```bash
cd /home/ubuntu/ost-platform && ./deploy/migrate-to-own-db.sh
```

It pauses auto-deploy, backs up `.env` and the old database, starts the
new container, copies the data, then **compares every table's row count and
stops if any differ**. Only once they match does it repoint `DATABASE_URL`
and restart the app.

The old database is read, never modified, so undoing it is restoring one file:

```bash
cp ~/ost-db-cutover/env.test.<timestamp>.bak .env
sudo docker compose --env-file .env -f deploy/docker-compose.yml up -d --force-recreate app
```

The script prints the exact path when it finishes. Leave the old database in
place for a week before dropping it.

---

## Signup approval

Anyone who signs up (email/password or Google) still creates an account
immediately, but cannot use the platform until an admin approves them.

The flow: sign up → verify email → pick a role → fill in startup basics →
**held pending approval**. That last screen is a dead end for the applicant —
no further onboarding step, nothing else to click — until an admin acts from
**Admin → Signup Approvals**. Every admin gets an email the moment someone
reaches that point, and the applicant gets one back once a decision is made.

Rejecting disables the account (`isActive = false`) rather than deleting it,
so there is a record of the decision. This is enforced through `requireAuth`,
which already re-checks `isActive` on every request, so nothing new had to be
added to keep a rejected account out.

This does not touch existing accounts: `onboardingStatus` only reaches
`pending_approval` through the signup flow, so anyone already `complete` is
unaffected.

---

## Automatic deployment

A systemd timer checks `origin/main` every five minutes and deploys it when
two conditions hold: CI passed for that commit, and the commit does not touch
the database schema.

It is pull-based, so nothing inbound is exposed and no deploy credentials are
stored on GitHub. The repository is public, so CI status is read anonymously.

**Schema changes are deliberately excluded.** Migrations can delete data (one
already has), so a commit touching `shared/schema.ts` or `server/migrate.mjs`
is not deployed automatically. You get a notification and run
`./deploy/deploy.sh` by hand after reviewing the diff.

### Installing it

```bash
sudo cp deploy/systemd/ost-autodeploy.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ost-autodeploy.timer
```

Edit `NOTIFY_TO` in `/etc/systemd/system/ost-autodeploy.service` to change
where notifications go, then `sudo systemctl daemon-reload`. Email is sent
through the app container's existing SMTP settings, so no mail credentials are
duplicated onto the host. Leave `NOTIFY_TO` empty to log only.

### Watching and controlling it

```bash
systemctl list-timers ost-autodeploy.timer          # when it next runs
sudo journalctl -u ost-autodeploy -f                # live log
sudo systemctl start ost-autodeploy.service         # run one check now
sudo systemctl disable --now ost-autodeploy.timer   # pause auto-deploy
```

A quiet log is normal: the script prints nothing when `main` has not moved.

### Trying it safely

Run one check by hand and watch what it decides:

```bash
NOTIFY_TO= /home/ubuntu/ost-platform/deploy/auto-deploy.sh
```

With `main` already deployed it exits silently, which confirms the wiring
without changing anything.

---

## Rollback / full teardown

Because everything here is isolated (own container, own database, own
CloudPanel site, own Docker volume), tearing it down cannot affect n8n, other
sites, or production data:

```bash
# Stop and remove the app container
docker compose --env-file .env -f deploy/docker-compose.yml down

# Also delete the uploaded-files volume (only if you want test uploads gone too)
docker volume rm ost_platform_uploads

# Drop the database (run as Postgres superuser)
# DROP DATABASE ost_platform;
# DROP USER ost_platform_user;
```

Then in CloudPanel: delete the `platform.open-startup.org` site (this
also removes its Nginx config and Let's Encrypt certificate).

To pause without deleting anything (e.g. overnight), just:
```bash
docker compose --env-file .env -f deploy/docker-compose.yml stop
```
and restart later with `docker compose --env-file .env -f deploy/docker-compose.yml start`.
