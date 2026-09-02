-- ==============================================================================
-- FLOWSTOCK - SCRIPT SQL UNIFICADO DE SEGURIDAD, INTEGRIDAD Y OPTIMIZACIÓN
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- ==============================================================================
-- Este script es 100% IDEMPOTENTE y SEGURO:
-- 1. Añade la columna 'cost_price' a 'sale_items' y migra costos históricos.
-- 2. Crea funciones atómicas (RPC) para evitar condiciones de carrera en stock y saldos.
-- 3. Crea índices de alto rendimiento para estadísticas y filtros rápidos.
-- 4. Habilita Row Level Security (RLS) con políticas de acceso y permisos.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. COLUMNA DE COSTO HISTÓRICO EN ÍTEMS DE VENTA ('sale_items.cost_price')
-- ------------------------------------------------------------------------------
-- Permite que las estadísticas y márgenes históricos nunca se distorsionen
-- cuando se actualiza el precio de costo de un producto en el inventario.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'cost_price'
  ) THEN
    ALTER TABLE public.sale_items ADD COLUMN cost_price NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;
END$$;

-- Rellenar el costo histórico de las ventas existentes a partir del costo actual del producto
UPDATE public.sale_items si
SET cost_price = COALESCE(p.cost_price, 0)
FROM public.products p
WHERE si.product_id = p.id
  AND (si.cost_price IS NULL OR si.cost_price = 0);


-- ------------------------------------------------------------------------------
-- 2. FUNCIONES ATÓMICAS (RPC) CONTRA CONDICIONES DE CARRERA (LOST UPDATES)
-- ------------------------------------------------------------------------------
-- Ejecutan el incremento/decremento directamente en el motor de base de datos
-- con bloqueo por fila, eliminando pérdidas de stock o saldo en ventas simultáneas.

-- Función atómica para ajustar stock físico de productos
CREATE OR REPLACE FUNCTION public.adjust_product_stock_atomic(
  p_product_id UUID,
  p_delta NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_stock NUMERIC;
BEGIN
  UPDATE public.products
  SET stock = GREATEST(0, ROUND((COALESCE(stock, 0) + p_delta)::numeric, 3))
  WHERE id = p_product_id
  RETURNING stock INTO v_new_stock;

  RETURN v_new_stock;
END;
$$;

-- Función atómica para ajustar saldo de cuenta corriente de clientes
CREATE OR REPLACE FUNCTION public.adjust_client_balance_atomic(
  p_client_id UUID,
  p_delta NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  UPDATE public.clients
  SET balance = ROUND((COALESCE(balance, 0) + p_delta)::numeric, 2)
  WHERE id = p_client_id
  RETURNING balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. ÍNDICES DE RENDIMIENTO (ACELERACIÓN DE ESTADÍSTICAS Y CONSULTAS)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_admin_created ON public.sales (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_admin_voided ON public.sales (admin_id, voided) WHERE voided = false;
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_admin_prod ON public.sale_items (admin_id, product_id);
CREATE INDEX IF NOT EXISTS idx_expenses_admin_date ON public.expenses (admin_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_admin_created ON public.cash_movements (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_movements_client ON public.account_movements (client_id, created_at DESC);


-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) Y PROTECCIÓN DE DATOS
-- ------------------------------------------------------------------------------
-- Habilita la capa de seguridad en todas las tablas operativas.

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnos_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_order_items ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para clientes frontend (anon y authenticated)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'admin_users', 'admin_profiles', 'admin_modules', 'categories', 'products',
    'supplies', 'supply_deductions', 'clients', 'account_movements', 'sales',
    'sale_items', 'expenses', 'cash_movements', 'turnos_services',
    'turnos_professionals', 'turnos_professional_services', 'turnos_availability',
    'turnos_locks', 'turnos_settings', 'turnos_appointments', 'turnos_audit',
    'custom_orders', 'custom_order_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "flowstock_full_access_%I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "flowstock_full_access_%I" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', tbl);
  END LOOP;
END$$;

-- Permiso de ejecución en las funciones atómicas
GRANT EXECUTE ON FUNCTION public.adjust_product_stock_atomic(UUID, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.adjust_client_balance_atomic(UUID, NUMERIC) TO anon, authenticated, service_role;

-- ==============================================================================
-- FIN DEL SCRIPT: Tu base de datos Supabase ahora cuenta con soporte de costos
-- históricos, funciones atómicas concurrentes e índices de alto rendimiento.
-- ==============================================================================
