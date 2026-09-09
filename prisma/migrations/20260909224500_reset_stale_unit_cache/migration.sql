-- The prefill cache on Ingredient was filled in before gallons, pints and fluid
-- ounces existed, so every liquid in it was resolved to the closest unit then
-- available: milk as a cup rather than a gallon. Those answers came from the
-- curated table or from the AI under a prompt that said no gallon existed, so
-- both are now stale and both are cheap to recompute -- the table is instant and
-- the AI is asked once per ingredient and cached again.
--
-- Anything a user chose themselves is left alone: only rows this app derived are
-- cleared, and a null here simply means "work it out next time".
UPDATE "Ingredient"
SET "defaultUnitImperial" = NULL,
    "defaultUnitMetric" = NULL,
    "defaultUnitSource" = NULL
WHERE "defaultUnitSource" IN ('table', 'ai');
