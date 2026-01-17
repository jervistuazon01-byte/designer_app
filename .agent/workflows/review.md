---
description: Inspect recent changes for bugs, errors, and regressions to ensure the task was successfully done.
---

1. **Understand Object**
   - Read `task.md` to see what was just completed.
   - Read `implementation_plan.md` (if it exists) to see the intended changes.

2. **Inspect Changes**
   - Run `git status` to see modified files.
   - Run `git diff` to view the actual code changes.
   - **CRITICAL**: Look for:
     - Syntax errors (missing brackets, typos).
     - Logic errors (undefined variables, wrong function calls).
     - Regressions (deleted code that should still be there).
     - Unintended formatting changes that break things.

3. **Verify Functionality (Mental Walkthrough)**
   - Trace the execution path of the modified code.
   - Does the new CSS actually apply to the HTML elements?
   - Does the JS logic handle edge cases (null checks, empty states)?

4. **Report Findings**
   - If issues are found, list them clearly.
   - If everything looks good, verify the `walkthrough.md` matches the actual work.
