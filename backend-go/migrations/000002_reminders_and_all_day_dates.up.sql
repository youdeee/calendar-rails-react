ALTER TABLE users
    ADD COLUMN time_zone VARCHAR NOT NULL DEFAULT 'Asia/Tokyo';

ALTER TABLE events
    ADD COLUMN start_on DATE,
    ADD COLUMN end_on DATE,
    ADD COLUMN reminder_minutes INTEGER;

UPDATE events
SET start_on = ((start_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo')::date,
    end_on = (((end_at - INTERVAL '1 second') AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo')::date,
    start_at = NULL,
    end_at = NULL
WHERE all_day = TRUE;

ALTER TABLE events
    ALTER COLUMN start_at DROP NOT NULL,
    ALTER COLUMN end_at DROP NOT NULL;

CREATE TABLE reminder_deliveries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users (id),
    event_id BIGINT NOT NULL REFERENCES events (id) ON DELETE CASCADE,
    occurrence_start_at TIMESTAMP NOT NULL,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX index_reminder_deliveries_on_event_id ON reminder_deliveries (event_id);
CREATE INDEX index_reminder_deliveries_on_user_id ON reminder_deliveries (user_id);
CREATE UNIQUE INDEX index_reminder_deliveries_on_event_id_and_occurrence_start_at
    ON reminder_deliveries (event_id, occurrence_start_at);
