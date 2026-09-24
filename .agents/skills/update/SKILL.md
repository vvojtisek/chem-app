---
name: update
description: Update and run this chemistry app locally. Use only when the user invokes /update, $update, or asks to refresh and restart this project's local app.
---

Run this workflow only in the VSCHT `chem-app` repository.

Run `pnpm local:update` from the repository. It fetches and fast-forwards the currently checked-out branch from its remote tracking branch, installs locked dependencies, starts the local database and Mailpit email catcher, builds the checkout, restarts the repository's frontend and API on `127.0.0.1`, checks their health routes, and leaves both servers running in the active terminal session. Local registration and password recovery emails can be viewed at `http://127.0.0.1:8025`.

Do not switch to `main` when the user is on a named test branch. The command refuses detached HEAD, a branch without a matching remote, divergent history, and dirty changes when incoming commits need to be merged. It preserves local edits when the remote branch has no new commits. Never stash, discard, commit, or push user changes as part of this workflow.

Keep the command session alive so the user can test. Report the branch and commit that were started, the frontend URL, API health URL, Mailpit URL, and any command failure. Ctrl+C stops the frontend and API; the local database and Mailpit remain running.
