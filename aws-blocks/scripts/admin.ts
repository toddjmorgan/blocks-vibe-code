/**
 * Admin CLI — create/list/disable user accounts from a terminal.
 *
 * There is no self-registration screen (see src/index.ts). Every account,
 * including the very first one, is created here. Mirrors scripps-vibe's
 * `cmd/admin` tool.
 *
 * Usage (run from the project root):
 *   npx tsx aws-blocks/scripts/admin.ts adduser someone@scripps.com
 *   npx tsx aws-blocks/scripts/admin.ts listusers
 *   npx tsx aws-blocks/scripts/admin.ts removeuser someone@scripps.com
 *   npx tsx aws-blocks/scripts/admin.ts enableuser someone@scripps.com
 *
 * Or via the npm script: `npm run admin -- adduser someone@scripps.com`
 *
 * This imports the backend module directly (not through the generated
 * `aws-blocks` RPC client), so it talks straight to the local .bb-data/
 * store — no dev server needs to be running.
 */
import { createInterface } from 'node:readline/promises';
import { auth, db, ALLOWED_EMAIL_DOMAIN } from '../index.js';
import { sql } from '@aws-blocks/blocks';

async function promptPassword(question: string): Promise<string> {
  // Automation/tests only — bypasses the interactive prompt. Never document
  // this to end users; passwords set this way land in shell history/env.
  if (process.env.BLOCKS_ADMIN_PASSWORD) return process.env.BLOCKS_ADMIN_PASSWORD;
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    // node:readline has no built-in masking; write the prompt, then mute echo
    // for the duration of this single answer.
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = '';
    const onData = (chunk: Buffer) => {
      const char = chunk.toString('utf8');
      if (char === '\n' || char === '\r') {
        stdin.setRawMode?.(false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(input);
      } else if (char === '\u0003') {
        process.exit(1);
      } else if (char === '\u007f') {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function validateDomain(email: string) {
  if (!email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed.`);
  }
}

async function adduser(email: string) {
  validateDomain(email);
  const password = await promptPassword('Password: ');
  const confirm = await promptPassword('Confirm password: ');
  if (password !== confirm) {
    throw new Error('Passwords do not match.');
  }
  await auth.signUp(email, password);
  const { rows } = { rows: await db.query<{ count: string }>(sql`SELECT count(*)::text FROM app_users`) };
  const isFirstUser = rows[0]?.count === '0';
  await db.execute(
    sql`INSERT INTO app_users (username, is_admin) VALUES (${email}, ${isFirstUser})`,
  );
  console.log(`Created ${isFirstUser ? 'admin ' : ''}user ${email}.`);
}

async function listusers() {
  const users = await db.query<{ username: string; is_admin: boolean; is_active: boolean; created_at: string }>(
    sql`SELECT username, is_admin, is_active, created_at FROM app_users ORDER BY created_at`,
  );
  if (users.length === 0) {
    console.log('No users yet.');
    return;
  }
  for (const u of users) {
    console.log(
      `${u.username}\t${u.is_admin ? 'admin' : 'user'}\t${u.is_active ? 'active' : 'disabled'}\t${u.created_at}`,
    );
  }
}

async function removeuser(email: string) {
  await db.execute(sql`UPDATE app_users SET is_active = false WHERE username = ${email}`);
  console.log(`Disabled ${email}. (AuthBasic keeps the credential record, but every API call is blocked while inactive.)`);
}

async function enableuser(email: string) {
  await db.execute(sql`UPDATE app_users SET is_active = true WHERE username = ${email}`);
  console.log(`Re-enabled ${email}.`);
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case 'adduser':
      if (!arg) throw new Error('Usage: adduser <email>');
      await adduser(arg);
      break;
    case 'listusers':
      await listusers();
      break;
    case 'removeuser':
      if (!arg) throw new Error('Usage: removeuser <email>');
      await removeuser(arg);
      break;
    case 'enableuser':
      if (!arg) throw new Error('Usage: enableuser <email>');
      await enableuser(arg);
      break;
    default:
      console.log('Usage: admin.ts <adduser|listusers|removeuser|enableuser> [email]');
      process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
