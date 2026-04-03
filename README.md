# StockFlow — Control de Inventario & Ventas Cloud

StockFlow es un sistema ligero y potente para la gestión de inventario, ventas, gastos y control de caja, conectado directamente a la nube mediante **Supabase**.

## 🚀 Funcionalidades
- **Gestión de Stock**: Seguimiento de productos con categorías, precios de costo y venta.
- **Módulo de Ventas**: Registro de ventas (Efectivo, Transferencia, Cuenta Corriente).
- **Control de Caja**: Seguimiento del efectivo físico en mano con registro de extracciones y depósitos.
- **Cuentas Corrientes**: Gestión de deudas de clientes y registros de pagos parciaels.
- **Insumos**: Inventario de materias primas/consumibles separado de los productos de venta.
- **Estadísticas**: Análisis mensual de ventas, margen bruto, gastos y ganancia neta.

## 🛠 Instalación y Configuración

El proyecto es una aplicación web estática (HTML/Pure JS). Para que funcione con tu propia base de datos, sigue estos pasos:

### 1. Configurar Supabase
Crea un nuevo proyecto en [Supabase](https://supabase.com/) y ejecuta el siguiente script en el **SQL Editor** para crear las tablas necesarias:

```sql
-- TABLA DE CATEGORÍAS
CREATE TABLE public.categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
-- TABLA DE PRODUCTOS
CREATE TABLE public.products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL, sell_price NUMERIC(10,2) NOT NULL DEFAULT 0, cost_price NUMERIC(10,2) NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
-- TABLA DE INSUMOS
CREATE TABLE public.supplies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 0, unit TEXT DEFAULT 'un', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.supply_deductions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supply_id UUID REFERENCES public.supplies(id) ON DELETE CASCADE, supply_name TEXT NOT NULL, quantity INTEGER NOT NULL, reason TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
-- TABLA DE CLIENTES
CREATE TABLE public.clients (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, phone TEXT, email TEXT, balance NUMERIC(10,2) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.account_movements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE, sale_id UUID, amount NUMERIC(10,2) NOT NULL, type TEXT NOT NULL, notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
-- TABLA DE VENTAS
CREATE TABLE public.sales (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), total NUMERIC(10,2) NOT NULL DEFAULT 0, payment_type TEXT NOT NULL, client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL, client_name TEXT, voided BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.sale_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE, product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, product_name TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price NUMERIC(10,2) NOT NULL);
-- TABLA DE GASTOS Y CAJA
CREATE TABLE public.expenses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), concept TEXT NOT NULL, amount NUMERIC(10,2) NOT NULL DEFAULT 0, date DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE public.cash_movements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), amount NUMERIC(10,2) NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
```

### 2. Vincular el Código
Edita el archivo `js/db.js` y coloca tu **URL** y **Anon Key** de Supabase:
```javascript
const supabaseUrl = 'TU_URL_DE_SUPABASE';
const supabaseKey = 'TU_ANON_KEY';
```

## 📄 Licencia
Este proyecto es de uso libre para gestión interna de negocios.
