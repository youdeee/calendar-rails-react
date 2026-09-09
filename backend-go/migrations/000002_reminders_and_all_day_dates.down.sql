DROP TABLE IF EXISTS reminder_deliveries;

UPDATE events
SET start_at = COALESCE(start_at, start_on::timestamp),
    end_at = COALESCE(end_at, (end_on + INTERVAL '1 day')::timestamp)
WHERE start_at IS NULL OR end_at IS NULL;

ALTER TABLE events
    ALTER COLUMN start_at SET NOT NULL,
    ALTER COLUMN end_at SET NOT NULL;

ALTER TABLE events
    DROP COLUMN IF EXISTS reminder_minutes,
    DROP COLUMN IF EXISTS end_on,
    DROP COLUMN IF EXISTS start_on;

ALTER TABLE users
    DROP COLUMN IF EXISTS time_zone;
