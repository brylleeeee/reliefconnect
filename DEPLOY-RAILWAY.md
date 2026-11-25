# Deploying ReliefConnect to Railway

This puts the Laravel API, the MySQL database and the React admin web on Railway, so the
system stays online even when nobody's laptop is on. The mobile app then points to the
Railway URL instead of a laptop IP.

## What you will end up with

One Railway project with 4 services, all from this one GitHub repo:

| Service | Comes from | What it does |
|---|---|---|
| **MySQL** | Railway's MySQL database | The database |
| **api** | `backend/` | Laravel API (mobile app + admin web talk to this) |
| **worker** | `backend/` | Queue jobs (push notifications, SOS scoring) + scheduler (unclaimed reminders) |
| **admin-web** | `frontend/` | React admin website for LGU / barangay admins |

> **Plan:** 4 services is over the Free plan's limit of 3, and Free services sleep when idle.
> Use the **Hobby plan ($5/month)** for the defense and the survey period.

## Before you start

- The repo changes for Railway are already in: `composer.json` requires PHP `^8.4` (the lock
  file needed 8.4.1+), `bootstrap/app.php` trusts Railway's proxy, and
  `backend/railway/run-worker.sh` runs the worker.
- Generate an app key on your laptop and copy it somewhere safe:
  ```bash
  cd backend
  php artisan key:generate --show
  ```
  It looks like `base64:xxxxxxxx...`. All backend services must use the **same** key.

---

## Step 1: Create the project and the database

1. Go to <https://railway.com>, log in with GitHub, and upgrade to Hobby.
2. **New Project → Deploy from GitHub repo → `brylleeeee/reliefconnect`.**
   (If the repo is not listed, click *Configure GitHub App* and give Railway access to it.
   The repo owner, Cyrus, may have to approve this.)
3. Railway creates one service from the repo. It will fail to build at first because the repo
   has 3 folders. That's expected; we fix it in Step 2.
4. In the project canvas click **+ Create → Database → MySQL**. Wait until it's green.

## Step 2: Set up the `api` service (Laravel)

Click the service created from the repo, then:

1. **Settings → rename it** to `api`.
2. **Settings → Source → Root Directory:** `/backend`
3. **Settings → Networking → Generate Domain.** You get something like
   `api-production-xxxx.up.railway.app`. Copy it.
4. **Variables → Raw Editor**, paste this, then fill in `APP_KEY` and `APP_URL`:

   ```env
   APP_NAME=ReliefConnect
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=base64:PASTE_YOUR_KEY_HERE
   APP_URL=https://api-production-xxxx.up.railway.app
   APP_TIMEZONE=Asia/Manila

   DB_CONNECTION=mysql
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_DATABASE=${{MySQL.MYSQLDATABASE}}
   DB_USERNAME=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}

   SESSION_DRIVER=database
   CACHE_STORE=database
   QUEUE_CONNECTION=database
   FILESYSTEM_DISK=local
   LOG_CHANNEL=stderr
   LOG_LEVEL=info
   MAIL_MAILER=log

   # SOS Prioritization AI (Gemini). The key stays on the server only.
   GEMINI_API_KEY=PASTE_YOUR_GEMINI_KEY_HERE
   GEMINI_MODEL=gemini-3.5-flash-lite
   GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite
   GEMINI_TIMEOUT=30
   GEMINI_DAILY_REQUESTS=500
   GEMINI_DAILY_TOKENS=0

   # Optional
   EXPO_ACCESS_TOKEN=
   ```

   - The Gemini key must also be on the **worker** service (Step 4), because the SOS scoring
     job runs there. Duplicating the api service copies it automatically.
   - Never commit the key to GitHub. If it was ever pushed, create a new key in Google AI Studio.

   - `${{MySQL.…}}` are Railway references to the database service; if you renamed the MySQL
     service, use its new name instead of `MySQL`.
   - `DB_CONNECTION=mysql` must be set **before the build**: Railway uses it to install the
     PHP MySQL driver.
   - `LOG_CHANNEL=stderr` makes Laravel errors show up in Railway's **Deploy Logs**.

5. **Add a volume for uploaded files** (household ID photos, birth certificates). Without it they
   are deleted on every redeploy. Right-click the `api` service → **Attach Volume**, mount path:
   `/app/storage/app`
6. Click **Deploy**. Railway detects Laravel, installs PHP 8.4, runs `composer install`,
   and on start runs `php artisan migrate --force` and `storage:link` automatically.
7. Test: open `https://<your-api-domain>/up` in a browser. A green "Application up" page means
   it's working.

## Step 3: Seed the database (once only)

The first deploy creates empty tables. Load the barangays and demo accounts once:

1. Install the Railway CLI on your laptop: `npm i -g @railway/cli`
2. ```bash
   railway login
   railway link        # pick the ReliefConnect project, then the api service
   railway ssh         # opens a shell inside the running api service
   php artisan db:seed --force
   exit
   ```

Do **not** run `migrate:fresh` on Railway once real survey data is in. It deletes everything.

## Step 4: Set up the `worker` service

1. In the canvas, right-click `api` → **Duplicate**. Rename the copy to `worker`.
   (Duplicating copies the variables too.)
2. **Settings → Deploy → Custom Start Command:**
   ```
   sh ./railway/run-worker.sh
   ```
3. **Variables:** add `RAILPACK_SKIP_MIGRATIONS=true` (the api service already runs migrations).
4. The worker does **not** need a public domain or the volume. If the duplicate copied them,
   remove them.
5. Deploy. In **Deploy Logs** you should see the queue worker waiting for jobs.

## Step 5: Set up the `admin-web` service (React)

1. **+ Create → GitHub Repo → `brylleeeee/reliefconnect`** again. Rename it to `admin-web`.
2. **Settings → Source → Root Directory:** `/frontend`
3. **Variables:**
   ```env
   VITE_API_URL=https://api-production-xxxx.up.railway.app/api
   ```
   (Your api domain from Step 2, plus `/api`.) Vite bakes this into the build, so
   **redeploy admin-web whenever you change it.**
4. **Settings → Networking → Generate Domain.**
5. Deploy, open the domain, and log in with an admin account.

## Step 6: Point the mobile app to Railway

In `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://api-production-xxxx.up.railway.app/api
```

Then restart Expo with `npx expo start -c`. Phones no longer need to be on the same Wi-Fi as a laptop.

For an APK build, also change `EXPO_PUBLIC_API_URL` in `mobile/eas.json` (the `preview` profile
still points to a laptop IP), then rebuild.

---

## Updating the live system

Railway redeploys automatically whenever someone pushes to `main`. New migrations run on
their own when the api service starts.

## Troubleshooting

| Problem | Where to look / what to do |
|---|---|
| Build fails on `composer install` with a PHP version error | Make sure `backend/composer.json` says `"php": "^8.4"` |
| `could not find driver` | `DB_CONNECTION=mysql` was missing at build time. Add it and redeploy |
| 500 error | api service → **Deploy Logs** (needs `LOG_CHANNEL=stderr`) |
| Admin web says "Could not reach the server" | Check `VITE_API_URL` ends with `/api` and redeploy admin-web |
| Push notifications / SOS scores never arrive | The worker service must be running; check its logs |
| Uploaded photos disappeared after a deploy | The volume isn't attached to api at `/app/storage/app` |
| Emails | Railway blocks SMTP on Hobby; keep `MAIL_MAILER=log` or use an email API such as Resend |
