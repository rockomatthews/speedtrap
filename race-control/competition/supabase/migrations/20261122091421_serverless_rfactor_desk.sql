CREATE TABLE IF NOT EXISTS race_control.desk_rooms (
  venue_id uuid PRIMARY KEY REFERENCES race_control.venues(id),
  state jsonb NOT NULL DEFAULT '{"rigs":[],"tickets":[]}'::jsonb
);
CREATE TABLE IF NOT EXISTS race_control.desk_rig_keys (
  id uuid PRIMARY KEY,
  venue_id uuid NOT NULL REFERENCES race_control.desk_rooms(venue_id),
  secret_hash text NOT NULL UNIQUE,
  revoked_at timestamptz
);
DO $grant$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'race_pilot') THEN
    GRANT SELECT, INSERT, UPDATE ON race_control.desk_rooms, race_control.desk_rig_keys TO race_pilot;
  END IF;
END
$grant$;
