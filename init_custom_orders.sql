-- ==============================================================================
-- FLOWSTOCK - SCRIPT SQL: MÓDULO DE ENCARGOS / PEDIDOS PROGRAMADOS
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- ==============================================================================

-- 1. Tabla Principal de Encargos / Pedidos Programados
CREATE TABLE IF NOT EXISTS public.custom_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    order_number BIGSERIAL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_address TEXT,
    delivery_datetime TIMESTAMPTZ NOT NULL,
    alert_lead_minutes INT NOT NULL DEFAULT 60, -- 60 min por defecto
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_preparacion', 'completado', 'cancelado')),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    deposit_payment_type TEXT DEFAULT 'efectivo',
    remaining_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes TEXT,
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 2. Tabla de Ítems del Encargo
CREATE TABLE IF NOT EXISTS public.custom_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_custom_orders_admin_status ON public.custom_orders(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_custom_orders_delivery ON public.custom_orders(delivery_datetime ASC);
CREATE INDEX IF NOT EXISTS idx_custom_order_items_order_id ON public.custom_order_items(order_id);

-- 4. Habilitar Row Level Security (RLS) y Políticas de Acceso
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for custom_orders" ON public.custom_orders;
CREATE POLICY "Allow all operations for custom_orders" ON public.custom_orders
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for custom_order_items" ON public.custom_order_items;
CREATE POLICY "Allow all operations for custom_order_items" ON public.custom_order_items
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Permisos de Rol Anon y Authenticated
GRANT ALL ON public.custom_orders TO anon, authenticated, service_role;
GRANT ALL ON public.custom_order_items TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
