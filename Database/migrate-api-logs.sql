-- Migration script to add api_logs table to existing AmarVote database
-- Run this script if you already have the database set up

-- API Logs table for tracking all API requests
CREATE TABLE IF NOT EXISTS api_logs (
    log_id BIGSERIAL PRIMARY KEY,
    request_method VARCHAR(10) NOT NULL,
    request_path TEXT NOT NULL,
    request_ip VARCHAR(50),
    user_agent TEXT,
    bearer_token TEXT,
    extracted_email VARCHAR(255),
    request_body TEXT,
    response_status INTEGER,
    request_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time BIGINT,
    error_message TEXT
);

-- API Logs indexes
CREATE INDEX IF NOT EXISTS idx_api_logs_email ON api_logs(extracted_email);
CREATE INDEX IF NOT EXISTS idx_api_logs_time ON api_logs(request_time DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_path ON api_logs(request_path);
CREATE INDEX IF NOT EXISTS idx_api_logs_ip ON api_logs(request_ip);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(response_status);

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✓ API Logs table and indexes created successfully.';
END $$;
