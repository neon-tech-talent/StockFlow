-- ============================================================
-- FlowStock — Script de migración completo (Supabase PostgreSQL)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- 4. INSERTAR PERFIL DE GUAJA
INSERT INTO admin_profiles (admin_id, system_name, logo_type, is_configured)
SELECT id, 'Entre Raíces', 'comida', true
FROM admin_users WHERE username = 'guaja'
ON CONFLICT (admin_id) DO NOTHING;

-- 5. AGREGAR COLUMNA admin_id A TABLAS DE DATOS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='admin_id') THEN
    ALTER TABLE categories ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='admin_id') THEN
    ALTER TABLE products ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='admin_id') THEN
    ALTER TABLE clients ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='account_movements' AND column_name='admin_id') THEN
    ALTER TABLE account_movements ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='admin_id') THEN
    ALTER TABLE sales ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='admin_id') THEN
    ALTER TABLE sale_items ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplies' AND column_name='admin_id') THEN
    ALTER TABLE supplies ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supply_deductions' AND column_name='admin_id') THEN
    ALTER TABLE supply_deductions ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='admin_id') THEN
    ALTER TABLE expenses ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cash_movements' AND column_name='admin_id') THEN
    ALTER TABLE cash_movements ADD COLUMN admin_id uuid REFERENCES admin_users(id);
  END IF;
END$$;

-- 6. ASIGNAR DATOS AL USUARIO GUAJA
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

-- 7. COLUMNAS ADICIONALES DE VENTAS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='invoiced') THEN
    ALTER TABLE sales ADD COLUMN invoiced boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='discount_type') THEN
    ALTER TABLE sale_items ADD COLUMN discount_type text NOT NULL DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='discount_value') THEN
    ALTER TABLE sale_items ADD COLUMN discount_value numeric DEFAULT 0;
  END IF;
END$$;

-- 8. TABLAS DEL MÓDULO DE GESTIÓN DE TURNOS

CREATE TABLE IF NOT EXISTS admin_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  module_key  text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT uq_admin_module UNIQUE (admin_id, module_key)
);

CREATE TABLE IF NOT EXISTS turnos_services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 30,
  price            numeric NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnos_professionals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  first_name  text NOT NULL,
  last_name   text DEFAULT '',
  phone       text DEFAULT '',
  email       text DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  user_id     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnos_professional_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES turnos_professionals(id) ON DELETE CASCADE,
  service_id      uuid NOT NULL REFERENCES turnos_services(id) ON DELETE CASCADE,
  CONSTRAINT uq_prof_service UNIQUE (professional_id, service_id)
);

CREATE TABLE IF NOT EXISTS turnos_availability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES turnos_professionals(id) ON DELETE CASCADE,
  day_of_week     integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnos_locks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES turnos_professionals(id) ON DELETE CASCADE,
  start_datetime  timestamptz NOT NULL,
  end_datetime    timestamptz NOT NULL,
  reason          text DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnos_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id             uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  buffer_minutes       integer NOT NULL DEFAULT 10,
  min_lead_hours       integer NOT NULL DEFAULT 2,
  max_advance_days     integer NOT NULL DEFAULT 30,
  cancellation_policy  text DEFAULT 'Cancelación permitida hasta 2 horas antes.',
  updated_at           timestamptz DEFAULT now(),
  CONSTRAINT uq_turnos_settings_admin UNIQUE (admin_id)
);

CREATE TABLE IF NOT EXISTS turnos_appointments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id             uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  client_id            uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name          text NOT NULL,
  client_phone         text DEFAULT '',
  service_id           uuid REFERENCES turnos_services(id) ON DELETE SET NULL,
  service_name         text NOT NULL,
  professional_id      uuid REFERENCES turnos_professionals(id) ON DELETE SET NULL,
  professional_name    text NOT NULL,
  start_datetime       timestamptz NOT NULL,
  end_datetime         timestamptz NOT NULL,
  duration_minutes     integer NOT NULL,
  price                numeric NOT NULL DEFAULT 0,
  status               text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmado', 'atendido', 'cancelado', 'ausente', 'reprogramado')),
  notes                text DEFAULT '',
  cancellation_reason  text DEFAULT '',
  cancelled_at         timestamptz,
  cancelled_by         text DEFAULT '',
  rescheduled_from_id  uuid REFERENCES turnos_appointments(id) ON DELETE SET NULL,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnos_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  user_name   text DEFAULT '',
  action      text NOT NULL,
  entity_name text NOT NULL,
  entity_id   uuid,
  details     text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointment_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES turnos_appointments(id) ON DELETE CASCADE,
  channel         text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'internal')),
  scheduled_at    timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error           text DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

-- 9. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_turnos_appt_admin_date ON turnos_appointments(admin_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_turnos_appt_prof ON turnos_appointments(admin_id, professional_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_turnos_appt_client ON turnos_appointments(admin_id, client_id);
CREATE INDEX IF NOT EXISTS idx_turnos_avail_prof ON turnos_availability(admin_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_locks_prof ON turnos_locks(admin_id, professional_id, start_datetime);

-- 10. REGISTRO INICIAL MÓDULO TURNOS
INSERT INTO admin_modules (admin_id, module_key, enabled)
SELECT id, 'turnos', true
FROM admin_users WHERE username = 'guaja'
ON CONFLICT (admin_id, module_key) DO NOTHING;
