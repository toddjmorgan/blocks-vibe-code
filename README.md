# blocks-vibe-code

A minimal login-required hello-world scaffold built on
[AWS Blocks](https://aws.amazon.com/products/developer-tools/blocks/) — the
same shape as `scripps-vibe`, but local development runs entirely on your
laptop via AWS Blocks' local-first tooling instead of Docker. There is no
`docker-compose.yml`, no containers, and no local Postgres server to run
yourself — `npm run dev` starts everything (backend, frontend, and a real
embedded Postgres) in one process.

## Prerequisites

- **Git**
- **Node.js 22+** (AWS Blocks requires it; Docker is not used or needed)
- **GitHub Copilot CLI**

Check your Node version:

```bash
node -v
npm -v
```

Then install the Copilot CLI:

```bash
npm install -g @github/copilot
```

Run it with:

```bash
./start-copilot.sh
```

This launches Copilot CLI with the commands this template's guardrails
skill already allows (`git`, `npm` — see "Standard dev loop" in
`.github/skills/vibe-code-guardrails/SKILL.md`) pre-approved, so you won't
be prompted individually for each one. Copilot will still ask for approval
before anything outside that set — including any destructive or unusual
command.

The first run will prompt you to log in with your GitHub account.

## Structure

```
aws-blocks/
  index.ts                   # Backend: auth, database, API (source of truth)
  index.cdk.ts                # CDK wiring for deploy (off-limits — see skill)
  migrations/                 # Numbered .sql migrations, applied automatically
  scripts/admin.ts             # Admin CLI: create/list/disable user accounts
src/
  index.ts                     # Frontend: login screen + hello-world + admin UI
index.html                     # HTML shell
test/e2e.test.ts               # API tests (auth, hello-world, user management)
APP_INFO.md                    # Name/description/cost center captured at scaffold time
```

Every Block (auth, database) exposes the same typed API locally and on AWS —
see `node_modules/@aws-blocks/blocks/docs/README.md` for the full catalog.
Locally: **AuthBasic** sessions are backed by a file-backed store, and
**Database** runs real Postgres via an embedded engine (PGlite) — both live
under `.bb-data/` (gitignored). On AWS: AuthBasic's users live in DynamoDB,
and Database provisions Aurora Serverless v2 (PostgreSQL) — same code, zero
changes.

## Quick start (first-time setup)

```bash
npm install
```

Create the first (admin) account with the admin CLI — **do this once, before
starting the dev server for the first time** (see "Why does the admin CLI
require the dev server to be stopped?" below):

```bash
npm run admin -- adduser jane.doe@scripps.com   # prompts for a password
```

**If a non-developer is going through this setup with Copilot's help,**
Copilot should ask them directly for the email and password to use, warning
them to pick a simple/throwaway password (not one reused anywhere else) —
since it will be visible to the AI in the process of creating the account —
then create the account for them using the command above. Do not tell a
non-developer user to go run that command themselves.

Only `@scripps.com` email addresses are accepted (enforced by the CLI and by
every account-creation code path). The very first account created is
automatically an admin.

Now start everything:

```bash
npm run dev
```

Visit http://localhost:3000 — sign in with the account you just created.
Leave this command running; press Ctrl+C to stop everything.

## Authentication

The app requires login — there is no self-registration screen (the sign-up
action is hidden from the login form, and non-developer users should never
be walked through creating one themselves outside the flows below).

- The **first account** is always created via the admin CLI (above), since no
  admin exists yet to sign in and create one.
- **Every account after that** can be created from inside the app: sign in as
  an admin, use the "Manage users" screen to add further `@scripps.com`
  accounts, and disable/re-enable accounts as needed.
- Disabling an account (from "Manage users", or `npm run admin -- removeuser
  <email>`) is a soft-delete — AuthBasic (the underlying Block) has no API to
  delete a credential outright, so a disabled account's login still succeeds,
  but every API call is rejected until it's re-enabled. This is enforced in
  `aws-blocks/index.ts`'s `requireActiveUser` helper, which every protected
  endpoint calls instead of the raw `auth.requireAuth`.

### Why does the admin CLI require the dev server to be stopped?

`aws-blocks/scripts/admin.ts` talks to the local Postgres/session store
directly (not through the running dev server), and AWS Blocks' local
implementations (PGlite, file-backed KVStore) only support one process at a
time. Run admin CLI commands (`adduser`, `removeuser`, `enableuser`) only
while `npm run dev` / `npm run dev:server` is **stopped**. Once the app is
running, use the in-app "Manage users" screen instead — it goes through the
same process as the running server, so there's no conflict.

```bash
npm run admin -- adduser someone@scripps.com
npm run admin -- listusers
npm run admin -- removeuser someone@scripps.com
npm run admin -- enableuser someone@scripps.com
```

The `adduser` prompt requires an interactive terminal (it won't accept a
piped password) — when creating the account on behalf of a non-developer,
use a pseudo-terminal wrapper such as `expect` to answer the password prompts.

## Running locally

```bash
npm run dev
```

This is the only command needed for local development — backend, frontend,
Postgres (PGlite), and sessions all run in this one process. Data persists
across restarts in `.bb-data/` (delete it to reset to a clean slate).

## Testing

```bash
npm run test:e2e
```

Starts a dev server automatically if one isn't already running (bootstrapping
a fresh admin account first — see above), or reuses one you already have
running in the background.

## Deploying

```bash
npm run sandbox      # ephemeral personal AWS sandbox — requires AWS credentials
npm run deploy        # full production deploy via CDK
npm run destroy        # tear down a production deploy
npm run sandbox:destroy  # tear down your sandbox
```

See `node_modules/@aws-blocks/blocks/docs/README.md` for details on what each
Block provisions on AWS.
