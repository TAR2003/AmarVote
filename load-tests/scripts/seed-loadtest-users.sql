-- Seed 2000 load-test voters for election 10.
-- Each email must exist in authorized_users AND allowed_voters (if election is listed).
--
-- Usage on server:
--   docker exec -i amarvote_postgres psql -U amarvote_user -d amarvote_db \
--     -v election_id=10 -v email_domain="'yourdomain.com'" \
--     < load-tests/scripts/seed-loadtest-users.sql

\set election_id 10
\set email_domain '''yourdomain.com'''

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
