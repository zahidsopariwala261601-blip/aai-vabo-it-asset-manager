-- =============================================================================
-- SUPABASE POSTGRESQL DATABASE SCHEMA
-- Application: AAI VABO IT Asset Management System
-- Compatible with: Supabase SQL Editor / Standard PostgreSQL 12+
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE (Authentication & RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- -----------------------------------------------------------------------------
-- 2. EMPLOYEES TABLE (Staff Directory)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    designation VARCHAR(255) DEFAULT '',
    department VARCHAR(255) DEFAULT '',
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_name ON public.employees(name);

-- -----------------------------------------------------------------------------
-- 3. ASSETS TABLE (Master Inventory Specifications & Hardware Telemetry)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    serial_number VARCHAR(255) NOT NULL UNIQUE,
    asset_tag VARCHAR(255) DEFAULT '',
    charger_serial VARCHAR(255) DEFAULT '',
    monitor_make VARCHAR(255) DEFAULT '',
    monitor_serial VARCHAR(255) DEFAULT '',
    keyboard_make VARCHAR(255) DEFAULT '',
    mouse_make VARCHAR(255) DEFAULT '',
    make VARCHAR(255) DEFAULT '',
    model VARCHAR(255) DEFAULT '',
    ip_address VARCHAR(255) DEFAULT '',
    hostname VARCHAR(255) DEFAULT '',
    current_user VARCHAR(255) DEFAULT 'IT Store',
    contractual_user_name VARCHAR(255) DEFAULT '',
    assigned_dept VARCHAR(255) DEFAULT '',
    assigned_desig VARCHAR(255) DEFAULT '',
    employee_id INTEGER REFERENCES public.employees(id) ON DELETE SET NULL,
    linked_asset_id INTEGER REFERENCES public.assets(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'In Stock',
    remark TEXT DEFAULT '',
    year_of_purchase INTEGER DEFAULT NULL,
    kva VARCHAR(50) DEFAULT '',
    warranty_expiry VARCHAR(255) DEFAULT '',
    last_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_last_update ON public.assets(last_update DESC);
CREATE INDEX IF NOT EXISTS idx_assets_name ON public.assets(name);
CREATE INDEX IF NOT EXISTS idx_assets_tag ON public.assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_assets_employee_id ON public.assets(employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_serial ON public.assets(serial_number);

-- -----------------------------------------------------------------------------
-- 4. TRANSACTIONS TABLE (Audit Trail & Asset Movement Logs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    asset_ids TEXT NOT NULL,
    asset_names TEXT DEFAULT '',
    ref_no VARCHAR(255) DEFAULT '',
    date VARCHAR(255) DEFAULT '',
    employee_name VARCHAR(255) NOT NULL,
    employee_desig VARCHAR(255) DEFAULT '',
    employee_dept VARCHAR(255) DEFAULT '',
    issuer_name VARCHAR(255) DEFAULT '',
    issuer_desig VARCHAR(255) DEFAULT '',
    issuer_dept VARCHAR(255) DEFAULT '',
    employee_id INTEGER REFERENCES public.employees(id) ON DELETE SET NULL,
    issuer_id INTEGER REFERENCES public.employees(id) ON DELETE SET NULL,
    remark TEXT DEFAULT '',
    is_protected INTEGER DEFAULT 0,
    edit_history JSONB DEFAULT '[]'::jsonb,
    last_edited_by VARCHAR(255) DEFAULT '',
    last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,
    deleted_by VARCHAR(255) DEFAULT '',
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    delete_reason TEXT DEFAULT '',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON public.transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

-- -----------------------------------------------------------------------------
-- 5. PRINT_LOGS TABLE (Security Print Telemetry)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.print_logs (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES public.transactions(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL DEFAULT 'Print',
    printed_by VARCHAR(255) NOT NULL DEFAULT '',
    printed_by_dept VARCHAR(255) DEFAULT '',
    system_ip VARCHAR(255) DEFAULT '',
    system_hostname VARCHAR(255) DEFAULT '',
    ref_no VARCHAR(255) DEFAULT '',
    doc_type VARCHAR(255) DEFAULT '',
    print_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_print_logs_tx ON public.print_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_ts ON public.print_logs(print_timestamp DESC);

-- -----------------------------------------------------------------------------
-- AUTOMATIC LAST_UPDATE TRIGGER FOR ASSETS TABLE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_assets_last_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_update = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assets_last_update ON public.assets;
CREATE TRIGGER trigger_assets_last_update
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION update_assets_last_update();
