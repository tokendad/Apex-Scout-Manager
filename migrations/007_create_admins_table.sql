-- Migration 007: Create admins table for system administrator management
-- Tracks which users have admin access, when they were granted/revoked, and who made the changes

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'super_admin')),
    "grantedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "grantedBy" UUID REFERENCES users(id) ON DELETE SET NULL,
    "revokedAt" TIMESTAMP WITH TIME ZONE,
    "revokedBy" UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for finding active admins efficiently
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins("userId");
CREATE INDEX IF NOT EXISTS idx_admins_active ON admins WHERE "revokedAt" IS NULL;
