-- Create activity_logs table to track all user actions
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    username VARCHAR(255) NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'publish', etc.
    entity_type VARCHAR(100) NOT NULL, -- 'schedule', 'employee', 'shift', etc.
    entity_id INTEGER,
    description TEXT NOT NULL,
    metadata JSONB, -- Additional data about the action
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
