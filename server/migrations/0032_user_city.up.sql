-- Where someone's based ("Brooklyn"), asked for during onboarding and shown
-- under their name on their profile. Free text, optional.
ALTER TABLE users ADD COLUMN city varchar(120);
