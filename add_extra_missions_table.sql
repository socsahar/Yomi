-- Create table for extra missions (משימות מחוץ למשמרת)
CREATE TABLE IF NOT EXISTS extra_missions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    hours VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    vehicle VARCHAR(100),
    driver_name VARCHAR(255),
    notes TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extra_missions_schedule ON extra_missions(schedule_id);
