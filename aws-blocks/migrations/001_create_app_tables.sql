-- Core tables for the blocks-vibe-code hello-world scaffold.
--
-- app_users tracks metadata (admin flag, active flag) alongside the
-- credential records AuthBasic manages internally — AuthBasic has no
-- concept of "admin" or user attributes of its own, so app-level metadata
-- lives here, keyed by the same username AuthBasic uses.
CREATE TABLE app_users (
  username TEXT PRIMARY KEY,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backs the GET /hello equivalent (getHello API method) — a single greeting
-- row read out of Postgres, mirroring scripps-vibe's hello_messages table.
CREATE TABLE greetings (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL
);

INSERT INTO greetings (message) VALUES ('Hello from blocks-vibe-code! Your greeting is stored in Postgres.');
