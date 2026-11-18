-- =============================================================================
-- Usuario de aplicación con mínimos privilegios (la CORRECCIÓN ya está
-- prepared en este archivo; el proyecto arranca usándolo).
--
-- La app se conecta hoy como superusuario `postgres` (ver docker-compose.yml).
-- La corrección es cambiar DB_USER/DB_PASSWORD por este usuario:
--
--     DB_USER: origen_app
--     DB_PASSWORD: origen_app_2024
--
-- Este usuario NO es superusuario: no puede crear bases, usuarios ni tocar
-- el esquema. Sólo puede leer y escribir datos del catálogo.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'origen_app') THEN
        CREATE ROLE origen_app LOGIN PASSWORD 'origen_app_2024';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE origen TO origen_app;
GRANT USAGE ON SCHEMA public TO origen_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO origen_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO origen_app;

-- Si más adelante se agregan tablas nuevas, hay que repetir los permisos:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO origen_app;
