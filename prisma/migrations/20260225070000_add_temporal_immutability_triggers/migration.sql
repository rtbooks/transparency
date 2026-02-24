-- Temporal Immutability Triggers
--
-- Enforces that existing rows in bitemporal tables can only have their
-- temporal closing fields updated (valid_to, system_to) and soft-delete
-- fields (is_deleted, deleted_at, deleted_by). All other columns are
-- immutable once a row is inserted.
--
-- This protects the audit trail: to "change" an entity, application code
-- must close the current version and INSERT a new row.

-- ─── Shared trigger function ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION enforce_temporal_immutability()
RETURNS TRIGGER AS $$
DECLARE
  col TEXT;
  old_val TEXT;
  new_val TEXT;
BEGIN
  -- Walk every column in the row and reject changes to non-temporal columns
  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = TG_TABLE_SCHEMA
      AND table_name   = TG_TABLE_NAME
      AND column_name NOT IN ('valid_to', 'system_to', 'is_deleted', 'deleted_at', 'deleted_by', 'updated_at')
  LOOP
    EXECUTE format('SELECT ($1).%I::text', col) INTO old_val USING OLD;
    EXECUTE format('SELECT ($1).%I::text', col) INTO new_val USING NEW;

    IF old_val IS DISTINCT FROM new_val THEN
      RAISE EXCEPTION
        'Temporal immutability violation on %.%: column "%" cannot be modified (old=%, new=%)',
        TG_TABLE_NAME, OLD.version_id, col, old_val, new_val;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Apply to all 6 bitemporal tables ───────────────────────────────────

CREATE TRIGGER trg_temporal_immutability_organizations
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_temporal_immutability();

CREATE TRIGGER trg_temporal_immutability_organization_users
  BEFORE UPDATE ON organization_users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_temporal_immutability();

CREATE TRIGGER trg_temporal_immutability_accounts
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_temporal_immutability();

CREATE TRIGGER trg_temporal_immutability_transactions
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_temporal_immutability();

CREATE TRIGGER trg_temporal_immutability_program_spending
  BEFORE UPDATE ON program_spending
  FOR EACH ROW
  EXECUTE FUNCTION enforce_temporal_immutability();

CREATE TRIGGER trg_temporal_immutability_contacts
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION enforce_temporal_immutability();
