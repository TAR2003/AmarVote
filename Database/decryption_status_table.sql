-- Create decryption_status table for tracking guardian decryption progress
-- This table maintains detailed status information about each guardian's decryption process

CREATE TABLE IF NOT EXISTS decryption_status (
    decryption_status_id BIGINT NOT NULL AUTO_INCREMENT,
    election_id BIGINT NOT NULL,
    guardian_id BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status values: 'pending', 'in_progress', 'completed', 'failed'
    
    -- Progress tracking
    total_chunks INT NOT NULL DEFAULT 0,
    processed_chunks INT NOT NULL DEFAULT 0,
    
    -- Current processing phase
    current_phase VARCHAR(100),
    -- Phase values: 'partial_decryption', 'compensated_shares_generation'
    
    -- Current chunk being processed
    current_chunk_number INT DEFAULT 0,
    
    -- Compensated guardian tracking
    compensating_for_guardian_id BIGINT,
    compensating_for_guardian_name VARCHAR(255),
    total_compensated_guardians INT DEFAULT 0,
    processed_compensated_guardians INT DEFAULT 0,
    
    -- Metadata
    guardian_email VARCHAR(255),
    guardian_name VARCHAR(255),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (decryption_status_id),
    UNIQUE KEY unique_election_guardian (election_id, guardian_id),
    FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    FOREIGN KEY (guardian_id) REFERENCES guardians(guardian_id) ON DELETE CASCADE,
    INDEX idx_election_status (election_id, status),
    INDEX idx_guardian_status (guardian_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
