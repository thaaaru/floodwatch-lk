-- FloodWatch LK Initial Database Schema
-- Run this script to set up the database

-- Subscribers table
CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    districts TEXT[] DEFAULT ARRAY['Colombo'],
    language VARCHAR(10) DEFAULT 'en',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alert history
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    district VARCHAR(50) NOT NULL,
    alert_level VARCHAR(20) NOT NULL,
    rainfall_mm DECIMAL(10,2),
    source VARCHAR(50),
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weather logs
CREATE TABLE IF NOT EXISTS weather_logs (
    id SERIAL PRIMARY KEY,
    district VARCHAR(50) NOT NULL,
    rainfall_mm DECIMAL(10,2),
    temperature_c DECIMAL(5,2),
    humidity_percent INTEGER,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(active);
CREATE INDEX IF NOT EXISTS idx_subscribers_districts ON subscribers USING GIN(districts);
CREATE INDEX IF NOT EXISTS idx_alert_history_district ON alert_history(district);
CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at ON alert_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_weather_logs_district_time ON weather_logs(district, recorded_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for subscribers updated_at
DROP TRIGGER IF EXISTS update_subscribers_updated_at ON subscribers;
CREATE TRIGGER update_subscribers_updated_at
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
