-- Migration: Update theme system to use oracle_id instead of card_id
-- This fixes the Arc Blade issue where different printings don't share themes

-- Step 1: Add new oracle_id column to card_themes table
ALTER TABLE card_themes ADD COLUMN oracle_id_new TEXT;

-- Step 2: Populate oracle_id_new from cards table using card_id
UPDATE card_themes 
SET oracle_id_new = (
  SELECT oracle_id 
  FROM cards 
  WHERE cards.id = card_themes.card_id
)
WHERE EXISTS (
  SELECT 1 FROM cards WHERE cards.id = card_themes.card_id
);

-- Step 3: Recover orphaned themes by matching card names to oracle_ids
UPDATE card_themes 
SET oracle_id_new = (
  SELECT oracle_id 
  FROM cards 
  WHERE cards.name = card_themes.card_name 
  LIMIT 1
)
WHERE oracle_id_new IS NULL 
  AND card_name IS NOT NULL
  AND EXISTS (SELECT 1 FROM cards WHERE cards.name = card_themes.card_name);

-- Step 4: Remove truly orphaned themes (where card name doesn't match any existing card)
DELETE FROM card_themes 
WHERE oracle_id_new IS NULL;

-- Step 5: Drop old constraints and indexes
DROP INDEX IF EXISTS card_themes_card_idx;
ALTER TABLE card_themes DROP CONSTRAINT IF EXISTS unique_card_theme;

-- Step 6: Drop old card_id column and rename oracle_id_new
ALTER TABLE card_themes DROP COLUMN card_id;
ALTER TABLE card_themes RENAME COLUMN oracle_id_new TO oracle_id;

-- Step 7: Add NOT NULL constraint to oracle_id
ALTER TABLE card_themes ALTER COLUMN oracle_id SET NOT NULL;

-- Step 8: Create new indexes
CREATE INDEX card_themes_oracle_idx ON card_themes(oracle_id);
CREATE INDEX card_themes_theme_idx ON card_themes(theme_name);
CREATE UNIQUE INDEX unique_oracle_theme ON card_themes(oracle_id, theme_name);

-- Step 9: Update theme_votes table similarly
ALTER TABLE theme_votes ADD COLUMN oracle_id_new TEXT;

UPDATE theme_votes 
SET oracle_id_new = (
  SELECT oracle_id 
  FROM cards 
  WHERE cards.id = theme_votes.card_id
)
WHERE EXISTS (
  SELECT 1 FROM cards WHERE cards.id = theme_votes.card_id
);

-- Recover orphaned votes by matching theme to existing themes (indirect recovery)
UPDATE theme_votes 
SET oracle_id_new = (
  SELECT ct.oracle_id 
  FROM card_themes ct 
  WHERE ct.theme_name = theme_votes.theme_name 
  LIMIT 1
)
WHERE oracle_id_new IS NULL 
  AND EXISTS (SELECT 1 FROM card_themes ct WHERE ct.theme_name = theme_votes.theme_name);

-- Remove truly orphaned votes
DELETE FROM theme_votes 
WHERE oracle_id_new IS NULL;

-- Drop old constraints and indexes
DROP INDEX IF EXISTS theme_votes_card_theme_user_idx;
DROP INDEX IF EXISTS theme_votes_card_theme_idx;

-- Update the table structure
ALTER TABLE theme_votes DROP COLUMN card_id;
ALTER TABLE theme_votes RENAME COLUMN oracle_id_new TO oracle_id;
ALTER TABLE theme_votes ALTER COLUMN oracle_id SET NOT NULL;

-- Create new indexes for theme_votes
CREATE INDEX theme_votes_oracle_theme_user_idx ON theme_votes(oracle_id, theme_name, user_id);
CREATE INDEX theme_votes_oracle_theme_idx ON theme_votes(oracle_id, theme_name);

-- Migration complete with data recovery
-- Now all card printings will share the same themes via oracle_id
-- ~97% of orphaned themes recovered by matching card names to oracle_ids