# 📧🛡️ Turning on Email Verification + Captcha

Good news: the feature is already built in. **It even works before you add any
keys** — until you set things up, the verification link just prints in the
`2-start.bat` window instead of being emailed, and the captcha box simply
doesn't appear. Add the keys below whenever you're ready to make it fully live.

> Your existing accounts (including your test login) are kept as "verified," so
> you won't get locked out. Only NEW sign-ups will need to verify.

---

## STEP 0 — Apply the update (do this first)

1. Close any black app windows.
2. Double-click **`1-install.bat`** and wait for **"Setup complete."**
   (This installs the email component and adds the new database fields.)
3. Double-click **`2-start.bat`**.

You can already test sign-up now: create a new account, and the verification
link will appear in the `2-start.bat` window — open it to verify.

---

## PART A — Send real emails (Google Workspace SMTP)

You'll send from one of your `@open-startup.org` addresses (e.g.
`crm@open-startup.org`). Google needs an **App Password** for this.

1. Sign in to that Google account in your browser.
2. Turn on **2-Step Verification** (required for app passwords):
   - Go to **myaccount.google.com → Security → 2-Step Verification** and turn it on.
3. Create an **App Password**:
   - Go to **myaccount.google.com/apppasswords**
   - Name it `OST Platform` and click **Create**.
   - Google shows a **16-character password** (like `abcd efgh ijkl mnop`).
     Copy it and remove the spaces.
4. Open the **`.env`** file in VSCode and fill these lines:
   ```
   SMTP_USER=crm@open-startup.org        (the address you're sending from)
   SMTP_PASS=abcdefghijklmnop             (the 16-char app password, no spaces)
   SMTP_FROM=crm@open-startup.org         (same address)
   ```
   Leave `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=587` as they are.
5. **Save** the file, then restart the app (close the `2-start.bat` window and
   double-click it again — settings only load when the app starts).

> If **myaccount.google.com/apppasswords** says it's not available, your
> Workspace admin has app passwords turned off. An admin can enable them in the
> Google Admin console, or tell me and I'll suggest an alternative sender.

---

## PART B — Add the captcha (Google reCAPTCHA v2)

1. Go to **https://www.google.com/recaptcha/admin/create** (sign in).
2. Fill in:
   - **Label:** `OST Platform`
   - **reCAPTCHA type:** choose **"Challenge (v2)"** → **"I'm not a robot" Checkbox**
   - **Domains:** add `localhost` (add your real website domain later too)
3. Accept the terms and click **Submit**.
4. You'll get two keys: a **Site Key** and a **Secret Key**. Put them in `.env`:
   ```
   RECAPTCHA_SITE_KEY=your-site-key
   RECAPTCHA_SECRET_KEY=your-secret-key
   ```
5. **Save** and restart the app.

Now the "I'm not a robot" box appears on the sign-up form and must be ticked.

---

## How it behaves

- **Sign up** → account created → user lands on a "Verify your email" screen and
  can't reach the dashboard until they click the link in the email.
- The screen has a **Resend** button and auto-detects once they've verified.
- **Google sign-in** users skip verification (Google already verified them).
- No keys set? Email link prints to the console; captcha is skipped. Everything
  still works for testing.

Tell me if any window shows red text and I'll sort it out.
