---
description: Audit the application for bugs, errors, and regressions.
---

1. **Pre-Audit Checks**
   - Ensure you are on the correct branch and have the latest changes.
   - Run `git status` to ensure your working directory is clean or only has intended changes.

2. **Server Health Check**
   - // turbo
   - Run `npm start` to launch the server.
   - Verify that the server starts without errors in the terminal.
   - Check for "Server listening" or similar success messages.

3. **Runtime & Console Audit**
   - Open the application in a browser (usually `http://localhost:3000`).
   - Open the Browser Developer Tools (F12 or Ctrl+Shift+I).
   - Switch to the **Console** tab.
   - Refresh the page and look for red errors or yellow warnings.
   - Interact with the main features:
     - Creating/Editing objects.
     - Using the toolbar tools.
     - Saving/Loading.
   - Watch for new errors during interaction.

4. **Visual & Functional Regression Test**
   - Check the main UI layout:
     - Are toolbars valid and accessible?
     - Are fonts and colors consistent?
   - Test specific functionality recently modified:
     - Arrow tool behavior.
     - Gallery interaction.
     - Selection and properties panel.

5. **Reporting**
   - If issues are found, document them in `task.md` or a new issue report.
   - If a regression is found, use `git bisect` or `git log` to identify the cause.
