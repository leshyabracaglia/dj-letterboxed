-- Day and night parties as default tags. Stored as plain names like every
-- tag; the client shows them with a sun/moon (formatTag in lib/format.ts).
INSERT INTO "tags" ("name", "is_default") VALUES ('day', true), ('night', true)
ON CONFLICT ("name") DO UPDATE SET "is_default" = true;
