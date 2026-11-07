CREATE SCHEMA homeauto_cloud;
REVOKE ALL ON SCHEMA homeauto_cloud FROM PUBLIC;
CREATE TABLE homeauto_cloud.households (
  household_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE homeauto_cloud.hubs (
  household_id uuid PRIMARY KEY REFERENCES homeauto_cloud.households(household_id),
  hub_id uuid NOT NULL UNIQUE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (household_id, hub_id)
);
CREATE TABLE homeauto_cloud.catalogs (
  household_id uuid PRIMARY KEY,
  hub_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0 AND revision <= 9007199254740991),
  catalog jsonb NOT NULL CHECK (jsonb_typeof(catalog) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (household_id, hub_id) REFERENCES homeauto_cloud.hubs(household_id, hub_id)
);
-- This durable inbox is retained, including stale operations, to detect conflicting replays.
CREATE TABLE homeauto_cloud.receipts (
  household_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  hub_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0 AND revision <= 9007199254740991),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('accepted', 'stale')),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, operation_id),
  UNIQUE (household_id, hub_id, revision),
  FOREIGN KEY (household_id, hub_id) REFERENCES homeauto_cloud.hubs(household_id, hub_id)
);
CREATE INDEX receipts_received_idx ON homeauto_cloud.receipts(received_at);
ALTER TABLE homeauto_cloud.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeauto_cloud.households FORCE ROW LEVEL SECURITY;
ALTER TABLE homeauto_cloud.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeauto_cloud.hubs FORCE ROW LEVEL SECURITY;
ALTER TABLE homeauto_cloud.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeauto_cloud.catalogs FORCE ROW LEVEL SECURITY;
ALTER TABLE homeauto_cloud.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeauto_cloud.receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY household_scope ON homeauto_cloud.households USING (household_id::text = current_setting('homeauto.household_id', true));
CREATE POLICY hub_scope ON homeauto_cloud.hubs USING (household_id::text = current_setting('homeauto.household_id', true) AND hub_id::text = current_setting('homeauto.hub_id', true));
CREATE POLICY catalog_scope ON homeauto_cloud.catalogs USING (household_id::text = current_setting('homeauto.household_id', true) AND hub_id::text = current_setting('homeauto.hub_id', true)) WITH CHECK (household_id::text = current_setting('homeauto.household_id', true) AND hub_id::text = current_setting('homeauto.hub_id', true));
CREATE POLICY receipt_scope ON homeauto_cloud.receipts USING (household_id::text = current_setting('homeauto.household_id', true) AND hub_id::text = current_setting('homeauto.hub_id', true)) WITH CHECK (household_id::text = current_setting('homeauto.household_id', true) AND hub_id::text = current_setting('homeauto.hub_id', true));
REVOKE ALL ON ALL TABLES IN SCHEMA homeauto_cloud FROM PUBLIC;
