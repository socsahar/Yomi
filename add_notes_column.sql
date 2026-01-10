-- Add notes column to schedules table
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS notes TEXT;
