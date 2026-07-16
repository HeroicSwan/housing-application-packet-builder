REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO hapb_app, hapb_system;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hapb_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hapb_app;
GRANT EXECUTE ON FUNCTION app_private.current_organization_id() TO hapb_app;
GRANT EXECUTE ON FUNCTION app_private.bootstrap_installation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO hapb_system;

GRANT SELECT ON "Organization" TO hapb_system;
GRANT SELECT ON "User" TO hapb_system;
GRANT UPDATE ("failedLoginCount", "lockedUntil", "passwordHash", "passwordChangedAt", "mfaRecoveryCodesEncrypted") ON "User" TO hapb_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AuthSession", "MfaChallenge", "PasswordResetToken", "RateLimitBucket", "BackupRun" TO hapb_system;
GRANT SELECT, UPDATE ("downloadCount", "lastDownloadedAt") ON "SecureDownload" TO hapb_system;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hapb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO hapb_app;
