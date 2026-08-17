-- gen_random_uuid() için gerekli uzantı
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    age INTEGER,
    password_hash VARCHAR(255),
    subscription_tier VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. style_preferences
CREATE TABLE style_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    daily_style VARCHAR(50),
    color_preference VARCHAR(50),
    priority VARCHAR(50),
    style_icon VARCHAR(50),
    frequency VARCHAR(50),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50),
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true
);

-- 4. clothing_items
CREATE TABLE clothing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(200),
    color VARCHAR(50),
    brand VARCHAR(100),
    season VARCHAR(20),
    image_url VARCHAR(500),
    is_favorite BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. outfits
CREATE TABLE outfits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    occasion VARCHAR(50),
    is_favorite BOOLEAN DEFAULT false,
    times_worn INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. outfit_items
CREATE TABLE outfit_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outfit_id UUID REFERENCES outfits(id) ON DELETE CASCADE,
    clothing_item_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE
);

-- Index'ler
CREATE INDEX idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX idx_outfits_user_id ON outfits(user_id);

-- Başlangıç verisi: kategoriler (icon isimleri lucide-react ile eşleşir)
INSERT INTO categories (name, icon) VALUES
    ('Üst', 'shirt'),
    ('Alt', 'panel-bottom'),
    ('Elbise', 'triangle'),
    ('Ayakkabı', 'footprints'),
    ('Çanta', 'handbag'),
    ('Makyaj', 'sparkles');
