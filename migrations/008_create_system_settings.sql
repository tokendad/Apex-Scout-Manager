-- Migration 008: Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedBy" UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Seed default settings
INSERT INTO system_settings (key, value, description) VALUES
('site_maintenance_mode', 'false', 'Enable maintenance mode to block non-admin access'),
('allow_registration', 'true', 'Allow new user registration'),
('session_timeout_minutes', '60', 'Session timeout in minutes (requires restart to take effect)'),
('max_login_attempts', '5', 'Max login attempts before lockout'),
('email_sender_address', '"noreply@apexscout.com"', 'Default email sender address'),
('smtp_config', '{"host": "", "port": 587, "secure": false, "user": "", "pass": ""}', 'SMTP Configuration')
ON CONFLICT (key) DO NOTHING;

-- Index for fast lookups (though PK is fast enough, this is good practice)
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
