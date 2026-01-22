-- MDA Shift Scheduling System - Database Schema
-- PostgreSQL (Supabase)

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_temp_password BOOLEAN DEFAULT false,
    must_change_password BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50) UNIQUE,
    phone VARCHAR(20),
    email VARCHAR(255),
    position VARCHAR(255),
    station VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table (main schedule metadata)
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    schedule_date DATE NOT NULL,
    station VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(schedule_date, station)
);

-- Shifts table (morning, evening, night, etc.)
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    shift_name VARCHAR(255) NOT NULL,
    shift_order INTEGER NOT NULL,
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Operational units (vehicles, teams, resources)
CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
    unit_name VARCHAR(255) NOT NULL,
    unit_type VARCHAR(100), -- ambulance, motorcycle, supervisor, etc.
    unit_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Roles/positions within each unit
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
    role_name VARCHAR(255) NOT NULL,
    role_order INTEGER NOT NULL,
    ambulance_number VARCHAR(50), -- Ambulance/vehicle number per role
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignments (linking employees to roles)
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    manual_employee_name VARCHAR(255), -- Allow manual assignment of employees not in the employees list
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, schedule_id),
    CHECK (employee_id IS NOT NULL OR manual_employee_name IS NOT NULL)
);

-- Extra ambulances (מעל התקן)
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

-- Extra missions (משימות מחוץ למשמרת)
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedules_date_station ON schedules(schedule_date, station);
CREATE INDEX IF NOT EXISTS idx_shifts_schedule ON shifts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_units_shift ON units(shift_id);
CREATE INDEX IF NOT EXISTS idx_roles_unit ON roles(unit_id);
CREATE INDEX IF NOT EXISTS idx_assignments_role ON assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_schedule ON assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_extra_ambulances_schedule ON extra_ambulances(schedule_id);
CREATE INDEX IF NOT EXISTS idx_extra_missions_schedule ON extra_missions(schedule_id);
