-- ============================================================
-- FlowStock — Script de migración completo
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. CREAR TABLA admin_users
CREATE TABLE IF NOT EXISTS admin_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text UNIQUE NOT NULL,
  password    text NOT NULL,
  role        text NOT NULL DEFAULT 'admin',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- 2. CREAR TABLA admin_profiles
CREATE TABLE IF NOT EXISTS admin_profiles (
  admin_id      uuid PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  system_name   text NOT NULL DEFAULT '',
  logo_type     text NOT NULL DEFAULT '',
  is_configured boolean NOT NULL DEFAULT false
);

-- 3. INSERTAR SUPERADMIN (tutuca) y ADMIN (guaja)
INSERT INTO admin_users (username, password, role) VALUES
  ('tutuca', '2613', 'superadmin'),
  ('guaja',  '1234', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 4. INSERTAR PERFIL DE GUAJA (Entre Raíces, ya configurado)
INSERT INTO admin_profiles (admin_id, system_name, logo_type, is_configured)
SELECT id, 'Entre Raíces', 'comida', true
FROM admin_users WHERE username = 'guaja'
ON CONFLICT (admin_id) DO NOTHING;

-- 5. AGREGAR COLUMNA admin_id A TODAS LAS TABLAS DE DATOS
--    (se usa IF NOT EXISTS vía DO block para compatibilidad)

DO $$
BEGIN
  -- categories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='admin_id') THEN
    ALTER TABLE categories ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='admin_id') THEN
    ALTER TABLE products ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- clients
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='admin_id') THEN
    ALTER TABLE clients ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- account_movements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='account_movements' AND column_name='admin_id') THEN
    ALTER TABLE account_movements ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- sales
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='admin_id') THEN
    ALTER TABLE sales ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- sale_items
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='admin_id') THEN
    ALTER TABLE sale_items ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- supplies
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplies' AND column_name='admin_id') THEN
    ALTER TABLE supplies ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- supply_deductions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supply_deductions' AND column_name='admin_id') THEN
    ALTER TABLE supply_deductions ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='admin_id') THEN
    ALTER TABLE expenses ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  -- cash_movements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_movements' AND column_name='admin_id') THEN
    ALTER TABLE cash_movements ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
END$$;

-- 6. ASIGNAR TODOS LOS DATOS EXISTENTES (sin admin_id) AL USUARIO GUAJA
--    Esto preserva todos los datos actuales de Entre Raíces

DO $$
DECLARE guaja_id uuid;
BEGIN
  SELECT id INTO guaja_id FROM admin_users WHERE username = 'guaja';

  UPDATE categories        SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE products          SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE clients           SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE account_movements SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE sales             SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE sale_items        SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE supplies          SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE supply_deductions SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE expenses          SET admin_id = guaja_id WHERE admin_id IS NULL;
  UPDATE cash_movements    SET admin_id = guaja_id WHERE admin_id IS NULL;
END$$;

-- ============================================================
-- Fin del script. Verificar con:
-- SELECT username, role FROM admin_users;
-- SELECT * FROM admin_profiles;
-- ============================================================
