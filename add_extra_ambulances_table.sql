-- Create table for extra ambulances (מעל התקן)
CREATE TABLE IF NOT EXISTS extra_ambulances (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    working_hours VARCHAR(255) NOT NULL,
    station VARCHAR(255) NOT NULL,
    ambulance_number VARCHAR(50),
    driver_name VARCHAR(255),
    notes TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
