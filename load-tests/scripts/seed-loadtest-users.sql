-- Seed load-test voters for election 10 (listed elections only).
-- With open registration + unlisted eligibility, synthetic JWT emails work without seeding.
--
-- Usage on server:
--   docker exec -i amarvote_postgres psql -U amarvote_user -d amarvote_db \
--     -v election_id=10 -v email_domain="'yourdomain.com'" \
--     < load-tests/scripts/seed-loadtest-users.sql

\set election_id 10
\set email_domain '''yourdomain.com'''

-- Optional: pre-create users rows (not required when REGISTRATION_OPEN_TO_ALL=true)
INSERT INTO users (email, password_hash, created_at)
SELECT
  'loadtest-voter-' || LPAD(g::text, 4, '0') || '@' || trim(both '''' from :'email_domain'),
  '',
  NOW()
FROM generate_series(1, 2000) AS g
ON CONFLICT (email) DO NOTHING;

INSERT INTO authorized_users (email, user_type, created_at)
SELECT
  'loadtest-voter-' || LPAD(g::text, 4, '0') || '@' || trim(both '''' from :'email_domain'),
  'user',
  NOW()
FROM generate_series(1, 2000) AS g
ON CONFLICT DO NOTHING;

-- For listed elections — add voters to election 10
INSERT INTO allowed_voters (election_id, user_email)
SELECT :election_id,
  'loadtest-voter-' || LPAD(g::text, 4, '0') || '@' || trim(both '''' from :'email_domain')
FROM generate_series(1, 2000) AS g
ON CONFLICT DO NOTHING;
