-- Migration 009: Remove council_admin role
-- 1. Revert any council_admin users to regular 'member' role (or upgrade to 'admin' via separate process if needed)
-- Since council_admin was deprecated, we map them to 'member' for safety. Real admins should be in 'admins' table.
UPDATE users SET role = 'member' WHERE role = 'council_admin';

-- 2. Update the check constraint to officially remove council_admin
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('scout', 'member', 'parent', 'volunteer', 'assistant',
                    'co-leader', 'cookie_leader', 'troop_leader',
                    'cookie_manager', 'admin'));
