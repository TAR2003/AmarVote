-- Link worker audit logs to persisted decryption result rows (not only election_center / tally context)
ALTER TABLE decryption_worker_log
    ADD COLUMN IF NOT EXISTS decryption_id BIGINT,
    ADD COLUMN IF NOT EXISTS compensated_decryption_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_decryption_worker_decryption'
    ) THEN
        ALTER TABLE decryption_worker_log
            ADD CONSTRAINT fk_decryption_worker_decryption
            FOREIGN KEY (decryption_id) REFERENCES decryptions(decryption_id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_decryption_worker_compensated'
    ) THEN
        ALTER TABLE decryption_worker_log
            ADD CONSTRAINT fk_decryption_worker_compensated
            FOREIGN KEY (compensated_decryption_id) REFERENCES compensated_decryptions(compensated_decryption_id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decryption_worker_decryption ON decryption_worker_log(decryption_id);
CREATE INDEX IF NOT EXISTS idx_decryption_worker_compensated ON decryption_worker_log(compensated_decryption_id);
