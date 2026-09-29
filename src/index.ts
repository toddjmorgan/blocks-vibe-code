/**
 * Frontend — src/index.ts
 *
 * Login-required hello-world app. Sign-up is disabled (see the
 * `hideActions: ['signUp']` below) — accounts are admin-created only, via
 * the admin CLI (bootstrap) or the "Manage users" screen (everyone after).
 */
import { api, authApi } from 'aws-blocks';
import { Authenticator, AuthenticatedContent, broadcastAuthChange } from '@aws-blocks/blocks/ui';
import { html, render } from 'lit-html';

const signInPrompt = Authenticator(authApi, {
  hideActions: ['signUp'],
  headings: { signedOut: 'Sign in to continue' },
});

document.getElementById('app')!.appendChild(
  AuthenticatedContent(authApi, (user) => {
    const container = document.createElement('div');

    let isAdmin = false;
    let view: 'home' | 'users' = 'home';
    let greeting = '';
    let users: { username: string; is_admin: boolean; is_active: boolean; created_at: string }[] = [];
    let errorMessage = '';

    async function load() {
      const me = await api.getMe();
      isAdmin = me.isAdmin;
      const hello = await api.getHello();
      greeting = hello.message;
      if (isAdmin && view === 'users') await loadUsers();
      redraw();
    }

    async function loadUsers() {
      users = await api.listUsers();
    }

    async function signOut() {
      await authApi.setAuthState({ action: 'signOut' });
      broadcastAuthChange(null);
    }

    async function addUser(e: SubmitEvent) {
      e.preventDefault();
      errorMessage = '';
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      try {
        await api.createUser(String(data.get('email') ?? ''), String(data.get('password') ?? ''));
        form.reset();
        await loadUsers();
        redraw();
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        redraw();
      }
    }

    async function toggleActive(username: string, nextActive: boolean) {
      try {
        await api.setUserActive(username, nextActive);
        await loadUsers();
        redraw();
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        redraw();
      }
    }

    function setView(next: 'home' | 'users') {
      view = next;
      errorMessage = '';
      if (next === 'users') {
        loadUsers().then(redraw);
      } else {
        redraw();
      }
    }

    function redraw() {
      render(html`
        <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <div>👤 ${user.username}</div>
          <div>
            ${isAdmin ? html`
              <button @click=${() => setView('home')} style="font-weight:${view === 'home' ? 'bold' : 'normal'}">Home</button>
              <button @click=${() => setView('users')} style="font-weight:${view === 'users' ? 'bold' : 'normal'}">Manage users</button>
            ` : ''}
            <button @click=${signOut}>Sign out</button>
          </div>
        </header>
        ${view === 'home' ? html`
          <h2>Hello</h2>
          <p>${greeting}</p>
        ` : html`
          <h2>Manage users</h2>
          ${errorMessage ? html`<p style="color:#b00">${errorMessage}</p>` : ''}
          <form @submit=${addUser} style="margin-bottom:16px">
            <input name="email" type="email" placeholder="someone@scripps.com" required />
            <input name="password" type="password" placeholder="Password" required minlength="8" />
            <button type="submit">Add user</button>
          </form>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="text-align:left;border-bottom:1px solid #ddd">
                <th>Email</th><th>Role</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => html`
                <tr style="border-bottom:1px solid #f0f0f0">
                  <td>${u.username}</td>
                  <td>${u.is_admin ? 'Admin' : 'User'}</td>
                  <td>${u.is_active ? 'Active' : 'Disabled'}</td>
                  <td>
                    <button @click=${() => toggleActive(u.username, !u.is_active)}>
                      ${u.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      `, container);
    }

    load();
    return container;
  }, signInPrompt)
);
