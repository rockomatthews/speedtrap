CREATE SCHEMA IF NOT EXISTS race_control;
REVOKE ALL ON SCHEMA race_control FROM PUBLIC;
CREATE TABLE IF NOT EXISTS race_control.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS race_control.credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES race_control.venues,
  provider text NOT NULL,
  secret_hash text UNIQUE NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS race_control.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  game text NOT NULL,
  track text NOT NULL,
  car text NOT NULL,
  build text NOT NULL,
  rules text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  phase text NOT NULL DEFAULT 'registration',
  allow_attested boolean NOT NULL DEFAULT false,
  publication jsonb,
  CHECK (ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS race_control.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES race_control.events,
  venue_id uuid NOT NULL REFERENCES race_control.venues,
  external_id text NOT NULL,
  alias text NOT NULL,
  checked_in_at timestamptz,
  UNIQUE (event_id, venue_id, external_id)
);
CREATE TABLE IF NOT EXISTS race_control.results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES race_control.events,
  entry_id uuid NOT NULL REFERENCES race_control.entries,
  venue_id uuid NOT NULL REFERENCES race_control.venues,
  provider text NOT NULL,
  source_id text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  payload jsonb NOT NULL,
  review text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, venue_id, provider, source_id, revision)
);
CREATE TABLE IF NOT EXISTS race_control.audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES race_control.events,
  action text NOT NULL,
  detail jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS result_event_current ON race_control.results(event_id, venue_id, provider, source_id, revision DESC);
