-- Preserve source-native categorical confidence without weakening the legacy
-- integer confidence field used by existing consumers.
ALTER TABLE isw.events
    ADD COLUMN IF NOT EXISTS confidence_raw text;

COMMENT ON COLUMN isw.events.confidence_raw IS
    'Provider-native confidence value; numeric integral values are also normalized into confidence.';
