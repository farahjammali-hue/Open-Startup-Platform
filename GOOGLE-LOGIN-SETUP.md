# 🔵 Turning on "Continue with Google"

The button already works in the code — it just needs two keys from Google.
Takes about 5–10 minutes, all in the browser. Free.

---

## 1. Open the Google Cloud Console

Go to **https://console.cloud.google.com** and sign in (use your
`@open-startup.org` account).

At the top, click the project dropdown → **New Project** → name it
`OST Platform` → **Create**. Make sure that project is selected afterward.

---

## 2. Set up the consent screen (what users see when logging in)

1. In the search bar type **"OAuth consent screen"** and open it.
2. Choose **External** → **Create**.
   *(External = anyone with a Google account can sign in, which is what you want
   for startups. Internal would limit it to only open-startup.org accounts.)*
3. Fill the required fields:
   - **App name:** `Open Startup`
   - **User support email:** your email
   - **Developer contact email:** your email
   - You can leave the rest blank.
4. Click **Save and Continue** through the next screens (Scopes, Test users) —
   no changes needed — then **Back to Dashboard**.
5. On the consent screen page, click **Publish app** → confirm.
   *(You only use basic name/email, so Google does NOT require any review or
   verification. Publishing just removes the 100-test-user limit.)*

---

## 3. Create the login keys

1. Search for **"Credentials"** and open it.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. **Application type:** `Web application`.
4. **Name:** `OST Local`.
5. Under **Authorized JavaScript origins**, click **Add URI** and enter:
   ```
   http://localhost:5000
   ```
6. Under **Authorized redirect URIs**, click **Add URI** and enter EXACTLY:
   ```
   http://localhost:5000/api/auth/google/callback
   ```
   ⚠️ This must match character-for-character, including `http://` and no
   trailing slash.
7. Click **Create**. A box pops up with a **Client ID** and a **Client secret** —
   keep it open (or click the copy icons).

---

## 4. Paste the keys into your .env

Open the **`.env`** file in VSCode and fill these two lines:

```
GOOGLE_CLIENT_ID=paste-the-client-id-here
GOOGLE_CLIENT_SECRET=paste-the-client-secret-here
```

(The client ID ends in `.apps.googleusercontent.com`. The secret starts with
something like `GOCSPX-`.)

**Save** the file (Ctrl + S).

---

## 5. Restart the app

Close the black **`2-start.bat`** window, then double-click **`2-start.bat`**
again. (Settings only load when the app starts.)

Go to the login page and click **Continue with Google** — it should now take you
to Google's sign-in instead of showing that message.

---

## Later: your real website domain

When you put this online at a real address (not localhost), come back to
**Credentials → your OAuth client** and add those same two URLs again but with
your real domain, e.g.:
- Origin: `https://app.open-startup.org`
- Redirect: `https://app.open-startup.org/api/auth/google/callback`

And update `APP_URL` in `.env` to that address.

---

### If you see "Error 400: redirect_uri_mismatch"
The redirect URI in Google doesn't exactly match. Re-check that it is
`http://localhost:5000/api/auth/google/callback` with no typos or trailing slash,
save in Google, wait a minute, and try again.
