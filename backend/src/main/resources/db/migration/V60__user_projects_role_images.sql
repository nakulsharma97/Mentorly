-- Extend user_projects with the optional Project Role and Project Image URLs
-- fields requested by the mentor Full Profile Setup spec. Both are nullable —
-- only title / description / technologies / startDate remain mandatory, so
-- profile completion is unaffected.

ALTER TABLE user_projects
    ADD COLUMN role VARCHAR(200) NULL AFTER live_demo_url,
    ADD COLUMN image_urls TEXT NULL AFTER role;
