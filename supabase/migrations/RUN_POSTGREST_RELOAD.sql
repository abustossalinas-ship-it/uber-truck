-- Opcional: avisar a PostgREST (API) que recargue el catálogo.
-- Si da error "unrecognized NOTIFY payload", ignóralo y sigue; las columnas ya están en Postgres.
NOTIFY pgrst, 'reload schema';
