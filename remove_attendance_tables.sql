-- Remove the retired biometric attendance feature and its stored data.
-- Back up the database before running; these drops are irreversible.
DROP TABLE IF EXISTS attendance_user_mapping;
DROP TABLE IF EXISTS attendance_logs;
DROP TABLE IF EXISTS attendance_devices;
