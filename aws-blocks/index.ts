/**
 * Backend — aws-blocks/index.ts
 *
 * Login-required hello-world scaffold: AuthBasic for sessions, Database
 * (Postgres via PGlite locally, Aurora Serverless v2 on AWS) for a stored
 * greeting plus app-level user metadata (admin flag, active flag).
 *
 * This file defines the API, auth, data model. The frontend imports these
 * exports via `import { api, authApi } from 'aws-blocks'`. The admin CLI
 * (`aws-blocks/scripts/admin.ts`) imports `auth` and `db` directly (bypassing
 * the RPC client) to create/list/disable accounts from a terminal.
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────────
 * Do NOT use local files, in-memory arrays, or local databases for persistence.
 * Use Building Blocks for cloud persistence and other common cloud abstractions.
 * They work locally with automatic mocks and deploy to AWS with zero configuration.
 *
 * For the full list of blocks and how to use them, see:
 *   node_modules/@aws-blocks/blocks/README.md
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ApiNamespace, Scope, AuthBasic, Database, sql, type BlocksContext } from '@aws-blocks/blocks';

const scope = new Scope('blocks-vibe-code');

// ─── Auth ────────────────────────────────────────────────────────────────────
// There is no self-registration screen (see src/index.ts — the signUp action
// is hidden from the Authenticator). Accounts are created from the admin CLI
// (aws-blocks/scripts/admin.ts), matching scripps-vibe's cmd/admin model.
export const auth = new AuthBasic(scope, 'auth', {
  passwordPolicy: { minLength: 8 },
  crossDomain: process.env.BLOCKS_SANDBOX === 'true',
});
export const authApi = auth.createApi();

/** Only accounts with this email domain may be created — enforced by the admin CLI. */
export const ALLOWED_EMAIL_DOMAIN = 'scripps.com';

// ─── Database ────────────────────────────────────────────────────────────────
export const db = new Database(scope, 'main', {
  migrationsPath: './aws-blocks/migrations',
});

/**
 * AuthBasic only knows about credentials — it has no concept of "admin" or
 * "disabled". Resolve app-level metadata (app_users) for the signed-in user,
 * then reject if the account has been deactivated (soft-deleted) by an admin.
 */
async function requireActiveUser(context: BlocksContext) {
  const user = await auth.requireAuth(context);
  const row = await db.queryOne<{ is_admin: boolean; is_active: boolean }>(
    sql`SELECT is_admin, is_active FROM app_users WHERE username = ${user.username}`,
  );
  if (!row?.is_active) throw new Error('This account has been disabled.');
  return { ...user, isAdmin: row.is_admin };
}

async function requireAdmin(context: BlocksContext) {
  const user = await requireActiveUser(context);
  if (!user.isAdmin) throw new Error('Forbidden: admin only.');
  return user;
}

// ─── API ─────────────────────────────────────────────────────────────────────
export const api = new ApiNamespace(scope, 'api', (context) => ({
  /** Who's signed in, and whether they can see the "Manage users" screen. */
  async getMe() {
    const user = await requireActiveUser(context);
    return { username: user.username, isAdmin: user.isAdmin };
  },

  /** Protected hello-world endpoint — reads the greeting out of Postgres. */
  async getHello() {
    await requireActiveUser(context);
    const row = await db.queryOne<{ message: string }>(
      sql`SELECT message FROM greetings ORDER BY id LIMIT 1`,
    );
    return { message: row?.message ?? 'Hello, world!' };
  },

  /** Admin only: list all accounts (for the "Manage users" screen). */
  async listUsers() {
    await requireAdmin(context);
    return await db.query<{ username: string; is_admin: boolean; is_active: boolean; created_at: string }>(
      sql`SELECT username, is_admin, is_active, created_at FROM app_users ORDER BY created_at`,
    );
  },

  /**
   * Admin only: create a new account from inside the app (the bootstrap
   * account still has to come from the admin CLI, since no admin exists yet
   * to sign in and call this). @scripps.com email addresses only.
   */
  async createUser(email: string, password: string) {
    await requireAdmin(context);
    if (!email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed.`);
    }
    await auth.signUp(email, password);
    await db.execute(sql`INSERT INTO app_users (username, is_admin) VALUES (${email}, false)`);
    return { success: true };
  },

  /**
   * Admin only: disable (soft-delete) an account. AuthBasic has no API to
   * delete credentials outright, so this flips `is_active`, which every
   * protected endpoint checks via requireActiveUser.
   */
  async setUserActive(username: string, isActive: boolean) {
    const admin = await requireAdmin(context);
    if (admin.username === username && !isActive) {
      throw new Error('You cannot disable your own account.');
    }
    await db.execute(sql`UPDATE app_users SET is_active = ${isActive} WHERE username = ${username}`);
    return { success: true };
  },
}));
