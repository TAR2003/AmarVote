#!/bin/bash

# Tally Creation Table Migration Script
# This script creates the tally_creation_status table in the AmarVote database

echo "==========================================="
echo "AmarVote - Tally Creation Table Migration"
echo "==========================================="
echo ""

# Database configuration
DB_NAME="amarvote"
DB_USER="root"  # Change this to your MySQL username
DB_HOST="localhost"
DB_PORT="3306"

echo "This will create the 'tally_creation_status' table in the $DB_NAME database."
echo ""
read -p "Do you want to continue? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Creating table..."

# Execute SQL
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME <<EOF
-- Create table to track tally creation status and progress
CREATE TABLE IF NOT EXISTS tally_creation_status (
    tally_status_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    election_id BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    total_chunks INT NOT NULL DEFAULT 0,
    processed_chunks INT NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL, -- Email of user who initiated tally creation
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    UNIQUE KEY unique_election_tally (election_id),
    FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    INDEX idx_election_status (election_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify table creation
SHOW TABLES LIKE 'tally_creation_status';
DESCRIBE tally_creation_status;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Table created successfully!"
    echo ""
    echo "You can now:"
    echo "1. Restart your backend application"
    echo "2. Test the tally creation feature"
    echo ""
else
    echo ""
    echo "❌ Error creating table. Please check the error messages above."
    echo ""
    exit 1
fi
