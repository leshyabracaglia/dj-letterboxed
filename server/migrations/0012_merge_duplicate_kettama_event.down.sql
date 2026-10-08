-- Intentionally a no-op: the merge in the up migration can't be undone (the
-- deleted event and series are gone, and which reviews came from it isn't
-- recorded). Rolling back past this version just leaves the merged data.
SELECT 1;
