# How to Configure Your API Key on Netlify

After you drag-and-drop the folder, your site exists but needs your key to work.

## 1. Go to Settings
1.  Click on your site in the **Netlify Dashboard**.
2.  Click **"Site configuration"** (or just "Site settings").
3.  Look for **"Environment variables"** in the sidebar (under "Build & deploy").

## 2. Add the Key
1.  Click **"Add a variable"**.
2.  Entering the following:
    *   **Key:** `GOOGLE_API_KEY`  <-- *Must be exactly this name!*
    *   **Value:** *(Paste your long Google API Key here)*
3.  Click **"Create variable"**.

## 3. Done!
Go to your site link and try it. It should work immediately.
