-- 2026-04-26: switch users from email/magic-link to first-name auth.
-- Backward compatible: keeps email column but allows NULL; backfills
-- username from email local-part for existing rows so anyone already
-- onboarded picks up their identity automatically.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username      varchar(50),
  ADD COLUMN IF NOT EXISTS display_name  varchar(200),
  ADD COLUMN IF NOT EXISTS is_owner      boolean NOT NULL DEFAULT false;

-- Backfill username from email (local-part, slugified) for any pre-refactor users
UPDATE users
   SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9]', '', 'g'))
 WHERE username IS NULL
   AND email IS NOT NULL;

-- Anyone whose username collapsed to empty (e.g. all symbols) gets a UUID-derived fallback
UPDATE users
   SET username = 'user_' || substr(replace(id, '-', ''), 1, 12)
 WHERE username IS NULL OR username = '';

-- Backfill display_name from name → email local-part
UPDATE users
   SET display_name = COALESCE(name, split_part(email, '@', 1), username)
 WHERE display_name IS NULL;

-- Promote configured owner email
UPDATE users SET is_owner = true, role = 'owner'
 WHERE lower(coalesce(email,'')) = lower(coalesce(current_setting('app.tyflix_owner_email', true), 'tylerheon@gmail.com'))
    OR lower(coalesce(username,'')) = 'tyler';

-- Constraints
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users(username);
DROP INDEX IF EXISTS uq_users_email;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Magic-link table is no longer used
DROP TABLE IF EXISTS magic_tokens;
