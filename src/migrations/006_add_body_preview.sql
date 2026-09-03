-- Add body_preview column for LLM entity scoring
-- Stores the first ~2000 chars of stripped page body fed to the entity scorer.
ALTER TABLE domain_classifications ADD COLUMN IF NOT EXISTS body_preview TEXT;

COMMENT ON COLUMN domain_classifications.body_preview IS 'First ~2000 characters of stripped page body, used by the EntityScorer for LLM-based scoring';
