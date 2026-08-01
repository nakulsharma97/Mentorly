-- V47: Audit Log → Activity Timeline & Security Audit System
-- Adds rich metadata columns to audit_logs so the admin timeline can show
-- severity, module, outcome, before/after values, device/browser/OS, request
-- correlation ids, endpoint, and retention archive state. All columns are
-- nullable or defaulted so existing rows are untouched.

ALTER TABLE audit_logs ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'INFO' AFTER action;
ALTER TABLE audit_logs ADD COLUMN module VARCHAR(40) AFTER severity;
ALTER TABLE audit_logs ADD COLUMN outcome VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' AFTER module;
ALTER TABLE audit_logs ADD COLUMN before_value TEXT AFTER details;
ALTER TABLE audit_logs ADD COLUMN after_value TEXT AFTER before_value;
ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(255) AFTER after_value;
ALTER TABLE audit_logs ADD COLUMN device VARCHAR(60) AFTER user_agent;
ALTER TABLE audit_logs ADD COLUMN browser VARCHAR(60) AFTER device;
ALTER TABLE audit_logs ADD COLUMN os VARCHAR(60) AFTER browser;
ALTER TABLE audit_logs ADD COLUMN request_id VARCHAR(64) AFTER os;
ALTER TABLE audit_logs ADD COLUMN correlation_id VARCHAR(64) AFTER request_id;
ALTER TABLE audit_logs ADD COLUMN endpoint VARCHAR(255) AFTER correlation_id;
ALTER TABLE audit_logs ADD COLUMN archived_at TIMESTAMP NULL AFTER endpoint;

-- Indexes for the filters + retention purge
ALTER TABLE audit_logs ADD INDEX idx_audit_severity (severity);
ALTER TABLE audit_logs ADD INDEX idx_audit_module (module);
ALTER TABLE audit_logs ADD INDEX idx_audit_outcome (outcome);
ALTER TABLE audit_logs ADD INDEX idx_audit_archived_at (archived_at);

-- Backfill severity for existing entries based on the action so the new
-- severity badge is meaningful immediately (critical = destructive/security).
UPDATE audit_logs SET severity = 'CRITICAL'
 WHERE action IN ('DELETE_USER','DELETE_SESSION','SUSPEND_USER','DELETE_REPORT',
                  'DELETE_FLAGGED_CONTENT','RESET_ALL_DATA','REFUND_PAYMENT',
                  'RELEASE_PAYMENT','BROADCAST_NOTIFICATION');
UPDATE audit_logs SET severity = 'WARNING'
 WHERE severity = 'INFO' AND action LIKE 'FAILED%';
