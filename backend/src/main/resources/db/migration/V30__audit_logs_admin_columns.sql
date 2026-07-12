-- Add columns to audit_logs for unified admin+user audit entity
ALTER TABLE audit_logs ADD COLUMN admin_id BIGINT AFTER resource_id;
ALTER TABLE audit_logs ADD COLUMN admin_email VARCHAR(255) AFTER admin_id;
ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(100) AFTER admin_email;
ALTER TABLE audit_logs ADD COLUMN entity_id BIGINT AFTER entity_type;

-- Make resource nullable now that entity_type/entity_id cover admin audits
ALTER TABLE audit_logs MODIFY COLUMN resource VARCHAR(255) NULL;

-- Add index for admin audit queries
ALTER TABLE audit_logs ADD INDEX idx_audit_admin_id (admin_id);
ALTER TABLE audit_logs ADD INDEX idx_audit_entity_type (entity_type);
