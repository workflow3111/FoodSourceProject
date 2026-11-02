-- Follow-up lookups read Shortlist by workspace and next date.
CREATE INDEX "Shortlist_workspaceKey_nextFollowUpOn_idx" ON "Shortlist"("workspaceKey", "nextFollowUpOn");

-- A contact person can belong to only one supplier. PostgreSQL 14 cannot
-- SET NULL a single column of a composite foreign key, so the existing
-- contactPersonId foreign key stays, and this trigger rejects a person
-- from another supplier or workspace.
CREATE OR REPLACE FUNCTION "ContactActivity_same_supplier"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."contactPersonId" IS NOT NULL THEN
    PERFORM 1
    FROM "SupplierContactPerson" AS person
    WHERE person."id" = NEW."contactPersonId"
      AND person."supplierId" = NEW."supplierId"
      AND person."workspaceKey" = NEW."workspaceKey";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Contact activity contactPersonId must belong to the same supplier and workspace'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ContactActivity_same_supplier" ON "ContactActivity";

CREATE TRIGGER "ContactActivity_same_supplier"
BEFORE INSERT OR UPDATE OF "contactPersonId", "supplierId", "workspaceKey"
ON "ContactActivity"
FOR EACH ROW
EXECUTE PROCEDURE "ContactActivity_same_supplier"();
