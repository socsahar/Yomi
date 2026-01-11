-- Fix timezone handling for activity_logs
-- Change TIMESTAMP to TIMESTAMPTZ to properly handle timezones
ALTER TABLE activity_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE activity_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- Update existing records to ensure they're in correct timezone
UPDATE activity_logs SET created_at = created_at AT TIME ZONE 'UTC' WHERE created_at IS NOT NULL;

-- Fix users table last_activity column if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'last_activity') THEN
        ALTER TABLE users ALTER COLUMN last_activity TYPE TIMESTAMPTZ USING last_activity AT TIME ZONE 'UTC';
        ALTER TABLE users ALTER COLUMN last_activity SET DEFAULT NOW();
    END IF;
END $$;
