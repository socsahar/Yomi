-- Add manual_employee_name column to assignments table
-- This allows manual assignment of employees not in the employees list

ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS manual_employee_name VARCHAR(255);

-- Make employee_id nullable to allow manual assignments
ALTER TABLE assignments 
ALTER COLUMN employee_id DROP NOT NULL;

-- Drop existing constraint if it exists
ALTER TABLE assignments 
DROP CONSTRAINT IF EXISTS check_employee_or_manual;

-- Add a more flexible check constraint
-- At least one must be provided, both can be NULL is not allowed
ALTER TABLE assignments 
ADD CONSTRAINT check_employee_or_manual 
CHECK (employee_id IS NOT NULL OR manual_employee_name IS NOT NULL);
