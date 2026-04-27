-- Update default daily_add_quota from 5 to 10
ALTER TABLE users ALTER COLUMN daily_add_quota SET DEFAULT 10;

-- Update existing users with the old default to the new default
UPDATE users SET daily_add_quota = 10 WHERE daily_add_quota = 5;
