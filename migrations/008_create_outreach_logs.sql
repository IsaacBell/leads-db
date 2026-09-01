-- Outreach sequence dispatch log. PII-adjacent — contact_id links to a PII row.
-- Every email sent or failed through the sequence dispatcher is recorded here.
-- This table does NOT store email addresses, subject lines, or bodies — only
-- the fact of delivery and which step of the sequence was attempted.

CREATE TABLE IF NOT EXISTS outreach_logs (
    id              BIGSERIAL PRIMARY KEY,
    workspace_id    UUID NOT NULL,
    contact_id      BIGINT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    step_sent       INTEGER NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message_id      TEXT,
    status          TEXT NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'failed', 'bounced', 'replied')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outreach_logs_contact
    ON outreach_logs (contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_workspace
    ON outreach_logs (workspace_id);

COMMENT ON TABLE outreach_logs
    IS 'Outreach sequence dispatch log. PII-adjacent — contact_id links to a PII row.';
COMMENT ON COLUMN outreach_logs.message_id
    IS 'Resend message ID (or null when status=failed before an API call was made).';
COMMENT ON COLUMN outreach_logs.status
    IS 'sent=delivered to Resend; failed=dispatch error; bounced=Resend bounce webhook; replied=contact replied.';
