#!/bin/sh
set -eu
psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=app_password="$HAPB_APP_PASSWORD" --set=system_password="$HAPB_SYSTEM_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE hapb_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS', :'app_password') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hapb_app') \gexec
SELECT format('CREATE ROLE hapb_system LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS', :'system_password') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hapb_system') \gexec
SELECT format('ALTER ROLE hapb_app PASSWORD %L', :'app_password') \gexec
SELECT format('ALTER ROLE hapb_system PASSWORD %L', :'system_password') \gexec
SQL
