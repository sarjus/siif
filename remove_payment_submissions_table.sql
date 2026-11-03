-- Remove the retired company payment submissions feature and its stored data.
-- Back up the database before running; this drop is irreversible.
DROP TABLE IF EXISTS company_payment_submissions;
