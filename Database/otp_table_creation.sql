-- OTP Verification Table
CREATE TABLE IF NOT EXISTS otp_verifications (
    otp_id SERIAL PRIMARY KEY,
    user_email TEXT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE
);

-- OTP Verification table indexes
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(user_email);
CREATE INDEX IF NOT EXISTS idx_otp_email_code ON otp_verifications(user_email, otp_code);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);
