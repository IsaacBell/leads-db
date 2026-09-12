-- Track which domain classifications have been promoted to CRM companies.
-- promoted_company_id = NULL means the domain has not yet been promoted.
-- Once set, a re-classification can still re-promote if the company is soft-deleted
-- (ON DELETE SET NULL will clear the reference), but the NULL-filtered index makes
-- the promotion query cheap for bulk scans.

ALTER TABLE domain_classifications
    ADD COLUMN IF NOT EXISTS promoted_company_id BIGINT
        REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dc_promoted
    ON domain_classifications (promoted_company_id)
    WHERE promoted_company_id IS NULL;
