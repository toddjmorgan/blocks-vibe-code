/**
 * End-to-end tests — tests the API via direct imports (same typed client the
 * frontend uses).
 *
 * Run:  npm run test:e2e
 *
 * There is no self-service sign-up API exposed to end users (see
 * src/index.ts), so tests bootstrap the first (admin) account the same way a
 * real deployment does: via `aws-blocks/scripts/admin.ts adduser`.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { installCookieJar, isServerRunning } from '@aws-blocks/blocks/utils';
import type { api as ApiType, authApi as AuthApiType } from 'aws-blocks';

const execFileAsync = promisify(execFile);

installCookieJar();

let server: ChildProcess | null = null;
let api: typeof ApiType;
let authApi: typeof AuthApiType;

const adminEmail = 'admin@scripps.com';
const adminPassword = 'AdminPass123!';
const memberEmail = 'member@scripps.com';
const memberPassword = 'MemberPass123!';

// ─── Setup (don't touch) ─────────────────────────────────────────────────────

test.before(async () => {
  const alreadyRunning = await isServerRunning();

  if (!alreadyRunning) {
    // Bootstrap the first (admin) account *before* the dev server starts.
    // The admin CLI and the dev server each open the local Postgres/KVStore
    // files directly (PGlite/KVStore are single-writer locally), so only one
    // process may hold them at a time — run the CLI, let it exit, then start
    // the server. (If reusing an already-running server, it's assumed to
    // have been bootstrapped by a prior run of this same test suite.)
    await execFileAsync('npx', ['tsx', 'aws-blocks/scripts/admin.ts', 'adduser', adminEmail], {
      cwd: process.cwd(),
      env: { ...process.env, BLOCKS_ADMIN_PASSWORD: adminPassword },
    });

    server = spawn('npm', ['run', 'dev:server'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    server.unref();
    await setTimeout(2000);
  }

  const mod = await import('aws-blocks');
  api = mod.api;
  authApi = mod.authApi;

  for (let i = 0; i < 30; i++) {
    try {
      await authApi.getAuthState();
      break;
    } catch {
      await setTimeout(1000);
    }
  }
});

test.after(() => {
  if (server?.pid) {
    try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  }
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

test('auth: starts signed out', async () => {
  const state = await authApi.getAuthState();
  assert.strictEqual(state.state, 'signedOut');
});

test('auth: unauthenticated access is rejected', async () => {
  await assert.rejects(() => api.getHello());
});

test('auth: bootstrap admin can sign in', async () => {
  const state = await authApi.setAuthState({ action: 'signIn', username: adminEmail, password: adminPassword });
  assert.strictEqual(state.state, 'signedIn');
  assert.strictEqual(state.user?.username, adminEmail);
});

test('me: bootstrap account is an admin', async () => {
  const me = await api.getMe();
  assert.strictEqual(me.username, adminEmail);
  assert.strictEqual(me.isAdmin, true);
});

// ─── Hello world ──────────────────────────────────────────────────────────────

test('hello: greeting comes from Postgres', async () => {
  const { message } = await api.getHello();
  assert.ok(message.length > 0);
});

// ─── User management (admin only) ─────────────────────────────────────────────

test('users: admin can create a non-admin account', async () => {
  await api.createUser(memberEmail, memberPassword);
  const users = await api.listUsers();
  const member = users.find(u => u.username === memberEmail);
  assert.ok(member);
  assert.strictEqual(member?.is_admin, false);
  assert.strictEqual(member?.is_active, true);
});

test('users: only @scripps.com emails are allowed', async () => {
  await assert.rejects(
    () => api.createUser('someone@example.com', 'SomePass123!'),
    /scripps\.com/,
  );
});

test('users: disabling an account blocks further API access', async () => {
  await api.setUserActive(memberEmail, false);

  await authApi.setAuthState({ action: 'signOut' });
  const signInState = await authApi.setAuthState({ action: 'signIn', username: memberEmail, password: memberPassword });
  assert.strictEqual(signInState.state, 'signedIn'); // AuthBasic credentials still valid

  await assert.rejects(() => api.getHello()); // but app-level access is blocked

  // Sign back in as admin for any remaining tests.
  await authApi.setAuthState({ action: 'signOut' });
  await authApi.setAuthState({ action: 'signIn', username: adminEmail, password: adminPassword });
});

test('users: admin cannot disable their own account', async () => {
  await assert.rejects(() => api.setUserActive(adminEmail, false));
});

test('users: re-enabling restores access', async () => {
  await api.setUserActive(memberEmail, true);
  const users = await api.listUsers();
  const member = users.find(u => u.username === memberEmail);
  assert.strictEqual(member?.is_active, true);
});
