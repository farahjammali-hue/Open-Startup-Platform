# 🚀 How to run the Open Startup platform on your computer

You don't need to know how to code. Just follow these steps in order.
You'll do steps 1 and 2 **once**. After that, starting the app is two double-clicks.

Total time the first time: about 10–15 minutes (most of it waiting).

---

## ✅ Step 1 — Install Node.js (one time)

Node.js is the engine that runs the app.

1. Go to **https://nodejs.org**
2. Click the big green button that says **"LTS"** (the recommended version).
3. Open the file it downloads and click **Next → Next → Install** (the defaults are fine). Accept any prompts.
4. When it finishes, click **Finish**.

That's it — you won't need to open Node.js itself. It just needs to be installed.

---

## ✅ Step 2 — Get a free database (one time)

The app needs a place to store data. **Neon** gives you one for free, no credit card.

1. Go to **https://neon.tech** and click **Sign up** (you can use your Google account).
2. After signing in, it asks you to **create a project**. Give it any name (e.g. "OST Platform") and click **Create**.
3. You'll land on a page showing a **connection string** — a long line that starts with:
   ```
   postgresql://...
   ```
   There's usually a **Copy** button next to it. Click **Copy**.
   *(If you see a "Connect" button, click it first, then copy the string. Pick the "psql" / "connection string" option if asked.)*
4. Now open the file named **`.env`** in this folder (you can open it inside VSCode — see Step 3).
   Find the line:
   ```
   DATABASE_URL=
   ```
   and paste your copied link right after the `=`, so it looks like:
   ```
   DATABASE_URL=postgresql://your-copied-link-here
   ```
5. **Save** the file (Ctrl + S).

> 💡 Keep this link private — it's the key to your database.

---

## ✅ Step 3 — Open this folder in VSCode

1. Open **VSCode**.
2. Go to the menu: **File → Open Folder…**
3. Select this folder: **All-in-One** (the one this guide is in) and click **Select Folder**.
4. If VSCode asks "Do you trust the authors?", click **Yes, I trust**.

You should now see all the project files listed on the left side.

---

## ✅ Step 4 — Set it up (one time)

In the folder, find the file **`1-install.bat`** and **double-click it**.

- A black window will open and start downloading things and creating your database tables.
- This takes a few minutes the first time. Lots of text will scroll by — that's normal.
- When it says **"Setup complete — you can close this window"**, close it.

> If double-clicking shows a blue "Windows protected your PC" box, click **More info → Run anyway**. (It's just because the file isn't from the internet.)

---

## ✅ Step 5 — Start the app

Double-click **`2-start.bat`**.

- A black window opens and after a moment shows:
  ```
  OST All-in-One running at http://localhost:5000
  ```
- **Leave this window open** — it's the app running. Closing it stops the app.

---

## ✅ Step 6 — Open it in your browser

1. Open Chrome (or any browser).
2. In the address bar type: **http://localhost:5000** and press Enter.
3. 🎉 You'll see the login screen. Create an account with your email and password, then walk through the flow.

---

## 🔁 Every time after this

You only repeat **Step 5 + Step 6**:
- Double-click **`2-start.bat`**
- Open **http://localhost:5000**

To **stop** the app, close the black window (or click in it and press `Ctrl + C`).

---

## 🆘 If something goes wrong

- **"npm is not recognized"** → Node.js (Step 1) didn't install, or you need to restart your computer once after installing it. Try again.
- **A database error when starting** → double-check that you pasted the full link into `.env` after `DATABASE_URL=` and saved the file (Step 2). Then run `1-install.bat` again.
- **The page won't load at localhost:5000** → make sure the `2-start.bat` window is still open and shows the "running at" message.
- **Anything else** → tell me exactly what the black window says (a screenshot is perfect) and I'll fix it.

---

## 🔒 Optional later — "Continue with Google" button

Email/password already works. To turn on Google sign-in, you'll create free keys
in Google's console and paste them into `.env`. Ask me when you're ready and I'll
walk you through it.
