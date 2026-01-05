# 🔧 How to Fix "Error 400: redirect_uri_mismatch"

This error happens because Google security blocks your local app from logging in. You must tell Google that it's safe to accept requests from your computer.

## ✅ The Quick Fix (Try this first!)

If you are using `http://127.0.0.1:3000`, try switching to **localhost**:

1. Close your current browser tab.
2. Open exactly this URL: **[http://localhost:3000](http://localhost:3000)**
3. Try clicking "Sync" again.

*(Why? Often `localhost` is authorized by default but `127.0.0.1` is not).*

---

## 🛠️ The Real Fix (Google Console)

If the above didn't work, you need to add your local URLs to the allowed list in Google Cloud Console.

### Step 1: Go to Google Cloud Console
Open this link:
👉 **[Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)**

### Step 2: Edit Your Client ID
1. Look for the section **"OAuth 2.0 Client IDs"**.
2. Click the **pencil icon ✏️** (Edit) next to your client name (e.g., "Web client 1" or "EmployeeHub").

### Step 3: Add Authorized Origins
1. Scroll down to **"Authorized JavaScript origins"**.
2. Click **"ADD URI"**.
3. Add: `http://localhost:3000`
4. Click **"ADD URI"** again.
5. Add: `http://127.0.0.1:3000`

It should look like this:
![Fix Origins Guide](google_console_fix_origins.png)

### Step 4: Save & Retry
1. Click the blue **"SAVE"** button at the bottom.
2. **Wait 1-2 minutes** (sometimes it takes a moment to update).
3. Go back to your app and refresh the page.
4. Click "Sync" again.

---

## 🛑 Still Stuck? Use the Apps Script Method

If you can't access the console or it's too complicated, use the **Apps Script method** which bypasses this entirely!

1. Open `README_TESTING.md` and follow the **"Google Apps Script"** instructions.
2. Once deployed, paste your Web App URL into `config.js`.
3. The app will then work without requiring you to sign in!
