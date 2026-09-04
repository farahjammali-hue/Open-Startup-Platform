# Deploying the internal test environment — technical runbook

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

- [ ] DNS: `platform-test.open-startup.org` points at this VPS's IP address
- [ ] You've picked a password for the Basic Auth gate (step 6)
- [ ] You know which teammate emails should be admins (`ADMIN_EMAILS`)
- [ ] You've decided whether to enable Google login / email / captcha for
      testing, or leave them off (recommended default: off)
- [ ] You know the Postgres container's name and the Docker network it runs
      on (see step 2) — both are required in `.env.test`

---

## 1. Get the code onto the VPS

```bash
git clone <your-repo-url> ost-platform-test
cd ost-platform-test
```

(Or `rsync`/`scp` the project folder if it's not in git yet. Either way, end
up with the project at some path like `/home/<user>/ost-platform-test`.)

## 2. Create an isolated test database

Connect to the VPS's existing Postgres as a superuser (e.g. `sudo -u postgres
psql`) and run:

```sql
CREATE DATABASE ost_platform_test;
CREATE USER ost_test_user WITH ENCRYPTED PASSWORD 'REPLACE_WITH_A_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE ost_platform_test TO ost_test_user;
\c ost_platform_test
GRANT ALL ON SCHEMA public TO ost_test_user;
```

This database is completely separate from anything production uses — nothing
here can touch real user data.

On this VPS, Postgres runs as a Docker CONTAINER, not on the host. The app
reaches it by container hostname over a shared Docker network, so
`host.docker.internal` does not apply. Collect both values now:

```bash
docker ps                                      # the Postgres container's name
docker inspect <postgres-container> --format "{{json .NetworkSettings.Networks}}"
```

The container name goes in `DATABASE_URL`; the network name goes in
`POSTGRES_DOCKER_NETWORK`. Both are set in step 3.

If your Postgres instead runs directly on the host, use
`host.docker.internal` in `DATABASE_URL`, add
`extra_hosts: ["host.docker.internal:host-gateway"]` back to the app service,
and remove the `networks:` blocks from docker-compose.yml. You may also need
to allow TCP connections from the Docker bridge range in `pg_hba.conf`.

## 3. Configure the environment

```bash
cp deploy/.env.test.example .env.test
nano .env.test   # fill in DATABASE_URL (with the password from step 2),
                  # SESSION_SECRET, and ADMIN_EMAILS at minimum
```

Generate a session secret:

```bash
openssl rand -hex 32
```

## 4. Build the image

```bash
docker compose --env-file .env.test -f deploy/docker-compose.yml build
```

## 5. Create the database schema (one-time, or after a schema change)

The production image intentionally excludes dev tools (like drizzle-kit) and
`server/migrate.mjs`, so schema work runs from the earlier "build" stage
instead. Load the network name into your shell first, since these are plain
`docker run` commands and don't read `.env.test` for it:

```bash
export $(grep '^POSTGRES_DOCKER_NETWORK=' .env.test | xargs)

docker build -f deploy/Dockerfile --target build -t ost-test-migrate .
docker run --rm --env-file .env.test \
  --network "$POSTGRES_DOCKER_NETWORK" \
  ost-test-migrate npm run db:push
docker run --rm --env-file .env.test \
  --network "$POSTGRES_DOCKER_NETWORK" \
  ost-test-migrate npm run db:migrate
```

`db:push` creates all tables (including the `session` table) from
`shared/schema.ts`. `db:migrate` then applies the incremental `ALTER`
statements in `server/migrate.mjs` on top. Run BOTH: the two are kept in
sync by hand and each covers changes the other doesn't. Both are idempotent
and safe to re-run.

Optional: seed the built-in Open Startup School catalogue and starter office
hours slots:

```bash
docker run --rm --env-file .env.test \
  --network "$POSTGRES_DOCKER_NETWORK" \
  ost-test-migrate npm run db:seed
```

## 6. Start the app

```bash
docker compose --env-file .env.test -f deploy/docker-compose.yml up -d
docker compose --env-file .env.test -f deploy/docker-compose.yml logs -f app   # watch it boot; Ctrl+C to stop watching
```

You should see `OST All-in-One running at http://localhost:5000` in the logs.
The container only listens on `127.0.0.1:5100` on the host — nothing public
yet. That's expected; CloudPanel handles the public side next.

## 7. Set up the site in CloudPanel

1. **Sites → Add Site → Reverse Proxy** (not "Node.js" — we're managing the
   app ourselves via Docker Compose, so a plain reverse proxy is simplest and
   least likely to conflict with anything CloudPanel auto-manages).
2. Domain: `platform-test.open-startup.org`
3. Reverse proxy target: `http://127.0.0.1:5100`
4. Save, then go to the site's **SSL/HTTPS** tab → enable **Let's Encrypt** →
   issue the certificate. CloudPanel handles the Nginx config and renewal.
5. **Basic Auth** (restrict to teammates only): in the site's settings, find
   **Basic Auth** (sometimes under a "Security" or "Tools" tab depending on
   your CloudPanel version) → enable it → set a username/password. Share that
   password with teammates out-of-band (Slack DM, not email).

   If your CloudPanel version doesn't expose a Basic Auth toggle, the
   equivalent manual step is adding to the site's Nginx vhost (CloudPanel
   usually gives you a "Vhost" edit box for exactly this):

   ```nginx
   location / {
       auth_basic           "Internal testing";
       auth_basic_user_file /etc/nginx/.htpasswd-platform-test;
       proxy_pass           http://127.0.0.1:5100;
       proxy_set_header     Host $host;
       proxy_set_header     X-Real-IP $remote_addr;
       proxy_set_header     X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header     X-Forwarded-Proto $scheme;
   }
   ```

   Generate the password file once:
   ```bash
   sudo htpasswd -c /etc/nginx/.htpasswd-platform-test teamuser
   ```

6. Visit `https://platform-test.open-startup.org` — you should hit the Basic
   Auth prompt first, then the app's own login screen after that.

## 8. Smoke test

- [ ] Basic Auth prompt appears before anything else loads
- [ ] Sign up a new test account — if SMTP isn't configured, the verification
      link appears in `docker compose --env-file .env.test -f deploy/docker-compose.yml logs app`
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
`.env.test` and make sure the SMTP settings are filled in. Invites go to every
active verified founder, every active verified admin, and the session's Zoom
host, with an update or cancellation whenever the session changes. Admins are
included on purpose: they run the sessions, so the person scheduling one
should see it in their own calendar. No Google setup or admin consent needed.

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
git pull
docker compose --env-file .env.test -f deploy/docker-compose.yml up -d --build
```

If `shared/schema.ts` or `server/migrate.mjs` changed, run the step 5
commands BEFORE the deploy above. Otherwise the new code queries columns the
database doesn't have yet, and every page that touches them fails with "The
database is out of date."

---

## Rollback / full teardown

Because everything here is isolated (own container, own database, own
CloudPanel site, own Docker volume), tearing it down cannot affect n8n, other
sites, or production data:

```bash
# Stop and remove the app container
docker compose --env-file .env.test -f deploy/docker-compose.yml down

# Also delete the uploaded-files volume (only if you want test uploads gone too)
docker volume rm ost_platform_test_uploads

# Drop the test database (run as Postgres superuser)
# DROP DATABASE ost_platform_test;
# DROP USER ost_test_user;
```

Then in CloudPanel: delete the `platform-test.open-startup.org` site (this
also removes its Nginx config and Let's Encrypt certificate).

To pause without deleting anything (e.g. overnight), just:
```bash
docker compose --env-file .env.test -f deploy/docker-compose.yml stop
```
and restart later with `docker compose --env-file .env.test -f deploy/docker-compose.yml start`.
