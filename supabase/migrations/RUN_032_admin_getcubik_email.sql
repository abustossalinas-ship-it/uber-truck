-- Cubik — admin definitivo: admin@getcubik.cl (misma contraseña que admin@cubik.cl)
-- Ejecutar en Supabase → SQL Editor después de crear el buzón en HostGator (opcional).

-- 1) Ver cuenta admin actual
SELECT id, email, role, full_name, kyc_status, created_at
FROM users
WHERE role = 'admin'
ORDER BY created_at;

-- 2) Migrar email (ajusta la lista IN si tu admin tiene otro correo)
UPDATE users
SET email = 'admin@getcubik.cl'
WHERE role = 'admin'
  AND lower(email) IN (
    'admin@cubik.cl',
    'admin@ubertruck.cl',
    'admin@getcubik.cl'
  );

-- Si hay más de un admin o el email origen es distinto, usa el UUID del paso 1:
-- UPDATE users SET email = 'admin@getcubik.cl' WHERE id = '<uuid>';

-- 3) Confirmar
SELECT id, email, role FROM users WHERE role = 'admin';
