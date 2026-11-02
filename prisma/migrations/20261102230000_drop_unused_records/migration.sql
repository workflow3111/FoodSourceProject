-- Contact people, activity history, and MediaAsset are not read or written by the app.
-- Shortlist still stores the current status, dates, person name, and method.
-- The follow-up index from 20261102220000_contact_integrity stays.

DROP TABLE IF EXISTS "ContactActivity";
DROP TABLE IF EXISTS "SupplierContactPerson";
DROP TABLE IF EXISTS "MediaAsset";

DROP FUNCTION IF EXISTS "ContactActivity_same_supplier"();

DROP TYPE IF EXISTS "ActivityType";
DROP TYPE IF EXISTS "CommunicationChannel";
DROP TYPE IF EXISTS "MediaKind";
