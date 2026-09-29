---
name: vibe-code-guardrails
description: Use this skill whenever a non-developer user asks to build, change, or "vibe code" a feature in this app (AWS Blocks scaffold — TypeScript backend + frontend, Postgres via the Database Block), or asks to create a new app from this template, or asks to push/publish/deploy their app. It enforces safe boundaries on what can be edited and standardizes how new apps are created from this template and pushed to git.
license: MIT
---

# Vibe Code Guardrails

This repository is a **template scaffold** (TypeScript backend + frontend on
[AWS Blocks](https://aws.amazon.com/products/developer-tools/blocks/),
Postgres via the `Database` Block) intended for **non-developer users** to
build simple business apps with AI assistance. Local development runs
entirely via `npm run dev` — there is no Docker, no containers, and no
separate database server to manage. This skill defines what is safe to
change, what is off-limits, and how to ship the result.

Always follow this skill when the user's request involves writing/changing
app code in this repo, scaffolding a new app from this template, or pushing
code anywhere.

## Entry-point prompts

In addition to any natural-language request, recognize these four short
trigger phrases as explicit entry points:

- **"vibe start"** — Immediately ask the user this exact question, verbatim, as
  your first response (do not ask anything else first, e.g. "what would you
  like to build"): "Do you want to create a new app, or update an existing
  one?" If new, follow the **"vibe new"** flow below. If existing, follow the
  **"vibe update"** flow below.
- **"vibe update"** — Look for apps previously built from this template that
  are reachable in the current environment (directories containing an
  `APP_INFO.md` and the `.github/skills/vibe-code-guardrails/` folder, e.g.
  via a targeted file search, plus anything already known from this
  session's conversation history). Present the candidates you find (by app
  name/`APP_INFO.md` description) and ask the user which one they mean.
  Never guess or pick one automatically when more than one candidate
  exists. Once confirmed, `cd` into that app's directory and proceed as a
  normal change request under Section 2 (never re-scaffold or overwrite it).
- **"vibe new"** — Go straight to Section 5 (creating a new app from this
  template); still run the Section 1 interview if it hasn't happened yet.
- **"vibe help"** — Reply with a short list of these trigger phrases and a
  one-line description of what each one does (`vibe start`, `vibe new`,
  `vibe update`, `vibe help`). Do not take any other action.

## 0. Protect the template itself (check this before anything else)

The template repository (`blocks-vibe-code`, remote:
`https://github.com/toddjmorgan/blocks-vibe-code`) must never be modified by
an end user building an app. It exists only to be cloned — see Section 5.
Every deliverable app lives in its own separate repo, cloned from this
template with its own git history.

Before making any app-code change (new API method, migration, feature,
etc.), check whether the current working directory is this template repo
itself, e.g.:

```bash
git remote get-url origin
```

- If it resolves to the template's own repo (`toddjmorgan/blocks-vibe-code`,
  or there is no distinct app-specific remote/history yet), **stop** — do not
  write app code here. Tell the user this directory is the shared template,
  not their app, and walk them through Section 5 (cloning a fresh copy into
  a new directory/repo) before doing anything else.
- Only a recognized developer/admin explicitly maintaining the template
  itself (improving the skill, docs, or scaffold for all future apps) may
  edit files directly in this repo. Everyday app-building requests from a
  non-developer always mean "do this in my cloned app," never "change the
  template."

## 1. New-app interview (run this first)

Before scaffolding a brand-new app (see Section 5) or making any code
changes in a freshly created app, conduct a short interview if this
information hasn't already been provided. Ask one question at a time:

1. **App name** (kebab-case, e.g. `expense-tracker`) — used for the
   directory, repo, and internal identifiers.
2. **Friendly app name** — a human-readable display name (e.g. `Expense
   Tracker`), shown in the browser tab title and header.
3. **Description** — one or two sentences on what the app does
4. **Cost center** — the billing/cost-center code this app should be
   attributed to

Record the answers in `APP_INFO.md` at the repo root (owner and created-date
can be filled with the current user/date). Do not proceed to writing app
code until these four answers are captured. If the user is only asking a
question or doesn't yet intend to build anything, skip the interview.

This repository also requires login for every app built from it — see
Section 7 for what that means for non-developer users.

## 2. Allowed changes (the "sandbox")

Only make changes inside these areas unless the user is a recognized
developer/admin explicitly overriding guardrails (see Section 5):

- `src/**` — frontend UI: components, pages, styles. Import backend APIs via
  `import { api, authApi } from 'aws-blocks'` (the typed, auto-generated
  client) — do not change how that import is configured or bundled.
- New methods added inside the existing `ApiNamespace(scope, 'api', ...)`
  object in `aws-blocks/index.ts` — new endpoints for new features. Do not
  touch the `auth`, `db` setup, `requireActiveUser`/`requireAdmin` helpers,
  or existing methods (`getMe`, `getHello`, `listUsers`, `createUser`,
  `setUserActive`) unless the user is a recognized developer/admin.
- `aws-blocks/migrations/**` — **additive only**: new numbered `.sql` files
  that add tables/columns/indexes. Never edit or delete an existing
  migration file.

When asked to "add a feature," prefer the smallest change that fits this
shape: a new migration if data storage is needed, a new method in the `api`
object that calls `requireActiveUser(context)` (or `requireAdmin(context)`
for admin-only features) before touching data, and a UI addition in `src/`
that calls it. Every authenticated view should show who's signed in and a
sign-out control, consistent with the existing header in `src/index.ts` —
don't duplicate or re-implement that pattern inline elsewhere.

## 3. Off-limits (do NOT touch without explicit developer override)

Refuse or redirect requests that require changing any of the following.
Explain briefly why, and suggest looping in a developer/admin instead:

- **Infra & deployment**: `aws-blocks/index.cdk.ts`, `aws-blocks/index.handler.ts`,
  `cdk.json`, `.blocks/config.json`, `vite.config.ts`, any CI/CD config
  (`.gitlab-ci.yml`, `.github/workflows/**`), or hosting/environment
  configuration.
- **Auth & security**: the `auth` (`AuthBasic`) setup, `requireActiveUser`,
  `requireAdmin`, `ALLOWED_EMAIL_DOMAIN`, `aws-blocks/scripts/admin.ts`, the
  `app_users` table/migration, or any secrets/credentials. Login is
  mandatory for every app built from this template and must never be
  removed, bypassed, or weakened (e.g., no re-enabling the `signUp` action in
  the `Authenticator`'s `hideActions` list, no calling `auth.requireAuth`
  directly in a new endpoint instead of `requireActiveUser`/`requireAdmin`,
  no logging/printing passwords or session tokens).
- **Dependencies & tooling**: `package.json`/`package-lock.json` versions,
  `tsconfig.json`, or introducing new third-party packages.
- **Environment/secret files**: never read, print, or edit any `.env` file
  (only extend one with new *non-secret* placeholder keys, and only if a new
  config value is genuinely required — flag this to the user clearly).
- Arbitrary shell commands beyond the standard dev loop (see Section 4). Never
  run destructive commands (`rm -rf` outside `.bb-data/` for a clean local
  reset, `git push --force`, `npm run destroy`/`npm run sandbox:destroy`
  without explicit confirmation, `git reset --hard` on shared branches, etc.).

If a request *requires* touching an off-limits area to work at all, stop and
tell the user plainly what's blocked and why, and suggest they ask a developer
to make that specific change.

## 4. Standard dev loop (safe commands)

These are the only commands this skill should run on the user's behalf:

```bash
npm install                                # first-time setup, or if node_modules is missing/stale
npm run admin -- adduser <email>           # first-time setup only — see README ("Authentication")
npm run dev                                 # start everything: backend, frontend, Postgres
npm run test:e2e                            # run the API tests
npm run typecheck                           # verify it compiles
```

Do not run `npm run admin -- ...` while `npm run dev` is already running —
see the README's "Why does the admin CLI require the dev server to be
stopped?" section. If the dev server is already running and a user account
needs to be created, use the in-app "Manage users" screen instead (once at
least one admin account exists).

New migrations are applied automatically when the dev server starts — no
separate migration command is needed.

Do not introduce new build tools, package managers, or scripts.

## 5. Creating a new app from this template

When the user wants to start a **new** app (not modify this one):

0. Every new app is fully independent of any app previously built from this
   template — never copy or carry over feature code, migrations, or other
   customizations from an earlier app. If prior app directories from this
   template already exist on disk, do not delete, move, or reuse them
   yourself. Instead, ask the user (plain chat question) whether they'd like
   to remove any old/unneeded app directories and re-clone before you
   proceed, and let them do that cleanup (or explicitly tell you to do it)
   before you scaffold the new app.
1. Confirm the new app's name (kebab-case, e.g. `expense-tracker`) — run the
   Section 1 interview if it hasn't happened yet.
2. Decide where the new app's directory will live: it must be a sibling
   directory to wherever this template (`blocks-vibe-code`) is actually
   cloned — never inside `copilot-worktrees/**` or any other CLI-managed/
   session-scoped worktree directory, even if the current working directory
   happens to be one. To find the real template location reliably, run
   `git worktree list` (from inside this repo) and use the parent directory
   of the **main** worktree path it reports (the first entry, not a
   session-specific worktree) as the base directory for the new app, e.g.
   `<parent-of-blocks-vibe-code>/<new-app-name>`.
3. Copy this template into a fresh directory named after the app, under the
   confirmed stable location — do not reuse this repo's `.git` history:
   ```bash
   git clone --depth 1 <this-template-repo-url> <new-app-name>
   rm -rf <new-app-name>/.git
   cd <new-app-name> && git init
   ```
4. Update the project name references (`package.json` `name` field, the
   `Scope('blocks-vibe-code')` id in `aws-blocks/index.ts`, and the title in
   `index.html`) to match `<new-app-name>`. The `stackId` in
   `.blocks/config.json` should also be regenerated for the new app rather
   than copied verbatim — run `npm install` in the new directory, which
   re-triggers scaffold setup, or ask a developer to regenerate it. Nothing
   else in the scaffold should change.
5. Keep the `.github/skills/vibe-code-guardrails/` folder intact in the new
   app — the same guardrails must apply there too.
6. Fill in `APP_INFO.md` with the interview answers from Section 1.
7. Delete any `.bb-data/` directory carried over from the template checkout
   (there shouldn't be one if `.gitignore` was respected, but check) so the
   new app starts with a clean local Postgres/session store.
8. Do not fabricate a remote URL. Ask the user for the target git location
   (see Section 6) before adding a remote or pushing.

## 6. Pushing / publishing

All new apps get their own repo, created under the organization's shared git
location (GitHub org — to be configured). Never invent this location.

1. Ask the user for the destination repo URL if it is not already configured
   as `git remote get-url origin` in the working directory, or already known
   from prior conversation in this session.
2. Once known:
   ```bash
   git remote add origin <destination-repo-url>   # only if not already set
   git add -A
   git commit -m "<clear, human-readable summary of the change>"
   git push -u origin <branch>
   ```
3. Never force-push. Never push directly if the destination already has a
   protected/default branch and the user hasn't confirmed the target branch
   name.
4. If no destination has been provided yet, stop and ask the user for it
   rather than pushing to a guessed location.

## 7. Login & user accounts

Every app built from this template requires the user to sign in — there is
no self-registration screen, by design (the `signUp` action is hidden from
the login form in `src/index.ts`):

- The **first account** is created from the admin CLI, since no admin exists
  yet to sign in and create one:
  ```bash
  npm run admin -- adduser someone@scripps.com   # prompts for a password
  npm run admin -- listusers
  npm run admin -- removeuser someone@scripps.com
  npm run admin -- enableuser someone@scripps.com
  ```
  Run these only while `npm run dev` is stopped — see the README.
- The first account created via `adduser` is automatically marked as an
  **admin** (`app_users.is_admin`). Admins see a "Manage users" button in the
  header that lists all users and lets them add or disable/re-enable
  accounts from inside the app itself, via the admin-only `listUsers`,
  `createUser`, and `setUserActive` methods in `aws-blocks/index.ts`. This is
  the one sanctioned exception to "auth internals are off-limits" in
  Section 3 — it already exists in the template; extend it (e.g. tweaking
  the UI) rather than re-implementing it, and never add a public/self-service
  signup path.
- **During first-time setup with a non-developer user:** ask them directly,
  as a plain chat question (not a masked/secret-style password field, which
  gets automatically redacted before the AI ever sees the value and breaks
  this step), for the email and password to use for their first account.
  Warn them clearly that the password will be visible to the AI/session in
  plain text, so they should pick a simple/throwaway password — never one
  reused anywhere else. Then run the `admin -- adduser` command on their
  behalf (the prompt requires a real terminal and won't accept a piped
  password — use a pseudo-terminal wrapper such as `expect` to answer the
  password prompts). Do not tell a non-developer to open a terminal and run
  this themselves.
- Only `@scripps.com` email addresses are accepted — enforced by both the CLI
  and the `createUser` API method (`ALLOWED_EMAIL_DOMAIN` in
  `aws-blocks/index.ts`). Never help a user work around this restriction or
  add accounts with other domains.
- Disabling an account is a soft-delete (AuthBasic has no API to delete
  credentials outright) — the account's login still succeeds, but every
  protected endpoint rejects it via `requireActiveUser`. Any new endpoint
  must call `requireActiveUser(context)` or `requireAdmin(context)`, never
  the raw `auth.requireAuth(context)`, or a disabled account would still be
  able to use it.
- If a technical user (developer/admin) asks "how do I log in" or "how do I
  create an account" and prefers to do it themselves so their password
  never passes through the AI, give them the `npm run admin -- adduser`
  command to run in their own terminal instead.

## 8. When in doubt

If a request is ambiguous about whether it touches an off-limits area,
ask the user a clarifying yes/no question before making the change. Prefer
being conservative — non-developer users rely on these guardrails to avoid
breaking the app or exposing secrets.
