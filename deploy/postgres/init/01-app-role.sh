#!/bin/sh
set -eu

: "${APP_DB_USER:?APP_DB_USER is required}"
: "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
	--set=database_name="$POSTGRES_DB" \
	--set=owner_name="$POSTGRES_USER" \
	--set=app_db_user="$APP_DB_USER" \
	--set=app_db_password="$APP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_db_user', :'app_db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_db_user')
\gexec

GRANT CONNECT ON DATABASE :"database_name" TO :"app_db_user";
GRANT USAGE ON SCHEMA public TO :"app_db_user";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_db_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_db_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_name" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_db_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner_name" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_db_user";
SQL
