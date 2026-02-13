-- Migration 006: Add Member Editing Fields
-- Adds contact information and password reset fields to support member editing functionality

-- Add contact and password reset fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastPasswordChange" TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordResetToken" VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users("passwordResetToken") WHERE "passwordResetToken" IS NOT NULL;

-- Add troop-specific fields to troop_members table (if not already present)
ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS den VARCHAR(50);
ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE troop_members ADD COLUMN IF NOT EXISTS "additionalRoles" JSONB;

CREATE INDEX IF NOT EXISTS idx_troop_members_den ON troop_members(den) WHERE den IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.phone IS 'Contact phone number';
COMMENT ON COLUMN users.address IS 'Mailing address';
COMMENT ON COLUMN users."passwordResetToken" IS 'Token for password reset (expires in 1 hour)';
COMMENT ON COLUMN users."passwordResetExpires" IS 'Expiration timestamp for password reset token';
COMMENT ON COLUMN users."lastPasswordChange" IS 'Timestamp of last password change';
COMMENT ON COLUMN troop_members.den IS 'Den or patrol assignment for scope filtering';
COMMENT ON COLUMN troop_members.position IS 'Leadership position or title';
COMMENT ON COLUMN troop_members."additionalRoles" IS 'Array of additional role identifiers (JSONB)';
