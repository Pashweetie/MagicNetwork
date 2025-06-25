-- Performance indexes for card search optimization
-- This migration adds specialized indexes to improve search performance from ~3.6s to sub-second

-- Enable pg_trgm extension for trigram text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Trigram indexes for ILIKE text search operations
-- These significantly improve performance for partial text matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_name_trgm_idx ON cards USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_oracle_text_trgm_idx ON cards USING gin (oracle_text gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_type_line_trgm_idx ON cards USING gin (type_line gin_trgm_ops);

-- 2. Missing single-column indexes for search filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_power_idx ON cards (power);
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_toughness_idx ON cards (toughness);

-- 3. Composite indexes for common search combinations
-- Name + CMC (common for searching specific cards with mana cost)
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_name_cmc_idx ON cards (name, cmc);

-- Colors + CMC (common for deck building)
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_colors_cmc_idx ON cards USING gin (colors, cmc);

-- Rarity + Set (common for collection filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_rarity_set_idx ON cards (rarity, set_code);

-- Type + Colors (common for tribal decks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_type_colors_idx ON cards USING gin (type_line gin_trgm_ops, colors);

-- 4. Specialized indexes for JSON operations
-- Color identity searches (for Commander format)
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_color_identity_gin_idx ON cards USING gin (color_identity);

-- Keywords array searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_keywords_gin_idx ON cards USING gin (keywords);

-- 5. Search result ordering optimization
-- Name + rarity for mixed result ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_name_rarity_idx ON cards (name, rarity);

-- CMC + name for mana curve analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_cmc_name_idx ON cards (cmc, name);

-- 6. Set-based searching improvements
-- Released date for chronological searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_released_date_idx ON cards (released_at);

-- Set + collector number for specific card lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_set_collector_idx ON cards (set_code, collector_number);

-- Performance notes:
-- - Using CONCURRENTLY to avoid blocking queries during index creation
-- - GIN indexes for array and trigram operations
-- - B-tree indexes for exact matches and range queries
-- - Trigram indexes will dramatically improve ILIKE performance
-- - Composite indexes optimize multi-filter searches

COMMIT;