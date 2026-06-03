-- Cubik — migrar cuenta admin a admin@cubik.cl (misma contraseña)
-- Ejecutar en Supabase SQL Editor. Ajusta el email origen si difiere.

-- 1) Ver fila actual
SELECT id, email, role, created_at
FROM users
WHERE role = 'admin'
ORDER BY created_at;

-- 2) Cambiar solo el email (password_hash no se toca → misma contraseña)
UPDATE users
SET email = 'admin@cubik.cl'
WHERE role = 'admin'
  AND email = 'admin@ubertruck.cl';

-- Si el email anterior era otro, usar:
-- WHERE role = 'admin' AND id = '<uuid-del-paso-1>';

-- 3) Confirmar
SELECT id, email, role FROM users WHERE role = 'admin';
