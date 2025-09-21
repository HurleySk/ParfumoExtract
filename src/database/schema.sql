-- ParfumoExtract Database Schema
-- PostgreSQL schema for storing fragrance data from Parfumo.com

-- Create main database
-- CREATE DATABASE parfumo_db;

-- Brands/Houses table
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    country VARCHAR(100),
    founded_year INTEGER,
    description TEXT,
    website VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Perfumers table
CREATE TABLE IF NOT EXISTS perfumers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fragrances table (main table)
CREATE TABLE IF NOT EXISTS fragrances (
    id SERIAL PRIMARY KEY,
    parfumo_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    brand_id INTEGER REFERENCES brands(id),
    release_year INTEGER,
    gender VARCHAR(50),
    fragrance_type VARCHAR(100),
    concentration VARCHAR(100),
    description TEXT,
    rating_value DECIMAL(3,2),
    rating_count INTEGER,
    longevity_rating DECIMAL(3,2),
    sillage_rating DECIMAL(3,2),
    bottle_size VARCHAR(100),
    url VARCHAR(500),
    last_crawled TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note categories
CREATE TABLE IF NOT EXISTS note_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category_id INTEGER REFERENCES note_categories(id),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fragrance notes relationship (with position: top, middle, base)
CREATE TABLE IF NOT EXISTS fragrance_notes (
    id SERIAL PRIMARY KEY,
    fragrance_id INTEGER REFERENCES fragrances(id) ON DELETE CASCADE,
    note_id INTEGER REFERENCES notes(id),
    position VARCHAR(20) CHECK (position IN ('top', 'middle', 'base', 'single')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fragrance_id, note_id, position)
);

-- Fragrance perfumers relationship
CREATE TABLE IF NOT EXISTS fragrance_perfumers (
    id SERIAL PRIMARY KEY,
    fragrance_id INTEGER REFERENCES fragrances(id) ON DELETE CASCADE,
    perfumer_id INTEGER REFERENCES perfumers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fragrance_id, perfumer_id)
);

-- Accords table
CREATE TABLE IF NOT EXISTS accords (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fragrance accords relationship with strength
CREATE TABLE IF NOT EXISTS fragrance_accords (
    id SERIAL PRIMARY KEY,
    fragrance_id INTEGER REFERENCES fragrances(id) ON DELETE CASCADE,
    accord_id INTEGER REFERENCES accords(id),
    strength INTEGER CHECK (strength >= 0 AND strength <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fragrance_id, accord_id)
);

-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE CHECK (name IN ('spring', 'summer', 'fall', 'winter'))
);

-- Fragrance seasons suitability
CREATE TABLE IF NOT EXISTS fragrance_seasons (
    id SERIAL PRIMARY KEY,
    fragrance_id INTEGER REFERENCES fragrances(id) ON DELETE CASCADE,
    season_id INTEGER REFERENCES seasons(id),
    suitability_score INTEGER CHECK (suitability_score >= 0 AND suitability_score <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fragrance_id, season_id)
);

-- Occasions table
CREATE TABLE IF NOT EXISTS occasions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fragrance occasions
CREATE TABLE IF NOT EXISTS fragrance_occasions (
    id SERIAL PRIMARY KEY,
    fragrance_id INTEGER REFERENCES fragrances(id) ON DELETE CASCADE,
    occasion_id INTEGER REFERENCES occasions(id),
    suitability_score INTEGER CHECK (suitability_score >= 0 AND suitability_score <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fragrance_id, occasion_id)
);

-- Crawl history for tracking and debugging
CREATE TABLE IF NOT EXISTS crawl_history (
    id SERIAL PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL,
    response_code INTEGER,
    error_message TEXT,
    items_extracted INTEGER DEFAULT 0,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_fragrances_brand ON fragrances(brand_id);
CREATE INDEX idx_fragrances_parfumo_id ON fragrances(parfumo_id);
CREATE INDEX idx_fragrances_rating ON fragrances(rating_value DESC);
CREATE INDEX idx_fragrance_notes_fragrance ON fragrance_notes(fragrance_id);
CREATE INDEX idx_fragrance_notes_note ON fragrance_notes(note_id);
CREATE INDEX idx_fragrance_perfumers_fragrance ON fragrance_perfumers(fragrance_id);
CREATE INDEX idx_crawl_history_created ON crawl_history(created_at DESC);
CREATE INDEX idx_crawl_history_status ON crawl_history(status);

-- Insert default seasons
INSERT INTO seasons (name) VALUES ('spring'), ('summer'), ('fall'), ('winter')
ON CONFLICT (name) DO NOTHING;

-- Insert common note categories
INSERT INTO note_categories (name) VALUES
    ('Citrus'), ('Floral'), ('Woody'), ('Oriental'), ('Fresh'),
    ('Fruity'), ('Spicy'), ('Gourmand'), ('Aromatic'), ('Green'),
    ('Aquatic'), ('Musky'), ('Powdery'), ('Sweet'), ('Animalic')
ON CONFLICT (name) DO NOTHING;

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fragrances_updated_at BEFORE UPDATE ON fragrances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perfumers_updated_at BEFORE UPDATE ON perfumers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();