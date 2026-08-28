-- ============================================================
-- FlowStock — Script de Inicialización Completo para Producción
-- ============================================================
-- Este script crea toda la estructura de la base de datos desde cero,
-- dejándola exactamente como está en producción actualmente, incluyendo
-- la gestión de permisos (superadmin/admin) y el módulo de turnos.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLAS DE AUTENTICACIÓN Y PERFILES (MÚLTIPLES INQUILINOS)
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text UNIQUE NOT NULL,
  password    text NOT NULL,
  role        text NOT NULL DEFAULT 'admin',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_profiles (
  admin_id      uuid PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  system_name   text NOT NULL DEFAULT '',
  logo_type     text NOT NULL DEFAULT '',
  is_configured boolean NOT NULL DEFAULT false
);

-- ============================================================
-- 2. TABLAS DEL SISTEMA DE STOCK Y VENTAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  sell_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'Unidades',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'un',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supply_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  supply_id UUID REFERENCES public.supplies(id) ON DELETE CASCADE,
  supply_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  dni TEXT,
  address TEXT,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  sale_id UUID,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  invoiced BOOLEAN NOT NULL DEFAULT FALSE,
  voided BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'none',
  discount_value NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. TABLAS DEL MÓDULO DE TURNOS
-- ============================================================

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

-- ============================================================
-- 4. ÍNDICES DE RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_turnos_appt_admin_date ON turnos_appointments(admin_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_turnos_appt_prof ON turnos_appointments(admin_id, professional_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_turnos_appt_client ON turnos_appointments(admin_id, client_id);
CREATE INDEX IF NOT EXISTS idx_turnos_avail_prof ON turnos_availability(admin_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_locks_prof ON turnos_locks(admin_id, professional_id, start_datetime);

-- ============================================================
-- 5. INSERCIÓN DE DATOS INICIALES (PERMISOS Y USUARIOS BASE)
-- ============================================================

-- Insertar Superadmin (tutuca) y Admin (guaja)
INSERT INTO admin_users (username, password, role) VALUES
  ('tutuca', '2613', 'superadmin'),
  ('guaja',  '1234', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insertar perfil para 'guaja'
INSERT INTO admin_profiles (admin_id, system_name, logo_type, is_configured)
SELECT id, 'Entre Raíces', 'comida', true
FROM admin_users WHERE username = 'guaja'
ON CONFLICT (admin_id) DO NOTHING;

-- Habilitar el módulo de turnos para 'guaja'
INSERT INTO admin_modules (admin_id, module_key, enabled)
SELECT id, 'turnos', true
FROM admin_users WHERE username = 'guaja'
ON CONFLICT (admin_id, module_key) DO NOTHING;
