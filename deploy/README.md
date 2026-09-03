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
here can touch real user data. Confirm Postgres is listening on the address
the Docker container will reach it at (usually `localhost`/`127.0.0.1` on the
host, which the container reaches via `host.docker.internal` — see
docker-compose.yml). If Postgres's `pg_hba.conf` only allows local socket
connections, you may need to allow TCP connections from the Docker bridge
network (ask if you want the exact `pg_hba.conf` line — not included here
since it depends on your Docker network range).

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
docker compose -f deploy/docker-compose.yml build
```

## 5. Create the database schema (one-time, or after a schema change)

The production image intentionally excludes dev tools (like drizzle-kit) to
stay small, so schema creation runs from the earlier "build" stage instead:

```bash
docker build -f deploy/Dockerfile --target build -t ost-test-migrate ..
docker run --rm --env-file .env.test \
  --add-host=host.docker.internal:host-gateway \
  ost-test-migrate npm run db:push
```

This creates all tables (including the `session` table) from
`shared/schema.ts` against the empty test database from step 2. It's safe to
re-run.

Optional: seed the built-in Open Startup School catalogue and starter office
hours slots:

```bash
docker run --rm --env-file .env.test \
  --add-host=host.docker.internal:host-gateway \
  ost-test-migrate npm run db:seed
```

## 6. Start the app

```bash
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml logs -f app   # watch it boot; Ctrl+C to stop watching
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
      link appears in `docker compose -f deploy/docker-compose.yml logs app`
- [ ] One of the `ADMIN_EMAILS` accounts sees the admin dashboard after login
- [ ] Upload a small file (e.g. a logo) somewhere and confirm it appears —
      confirms the uploads volume is writable
- [ ] Confirm `https://` (padlock) is present — cookies won't work over plain
      `http://` in production mode

---

## Redeploying after a code change

```bash
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

If `shared/schema.ts` changed, also re-run the step 5 migrate command.

---

## Rollback / full teardown

Because everything here is isolated (own container, own database, own
CloudPanel site, own Docker volume), tearing it down cannot affect n8n, other
sites, or production data:

```bash
# Stop and remove the app container
docker compose -f deploy/docker-compose.yml down

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
docker compose -f deploy/docker-compose.yml stop
```
and restart later with `docker compose -f deploy/docker-compose.yml start`.
