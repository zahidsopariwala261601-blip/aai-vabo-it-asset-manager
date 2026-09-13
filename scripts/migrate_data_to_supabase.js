/**
 * Automated Data Migration Script: SQLite -> Supabase PostgreSQL
 * Reads local SQLite database (database.db) and populates Supabase instance.
 *
 * Usage:
 *   DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres node scripts/migrate_data_to_supabase.js
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is required to migrate data to Supabase.');
    console.error('Example: DATABASE_URL="postgresql://postgres.xxx:pass@aws-0-xxx.pooler.supabase.com:6543/postgres" node scripts/migrate_data_to_supabase.js');
    process.exit(1);
}

const sqliteDbPath = path.resolve(__dirname, '..', 'database.db');
const sqlite = new sqlite3.Database(sqliteDbPath, (err) => {
    if (err) {
        console.error('Failed to open SQLite database:', err.message);
        process.exit(1);
    }
});

const pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

function sqliteAll(query, params = []) {
    return new Promise((resolve, reject) => {
        sqlite.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function migrateData() {
    console.log('--- Starting Migration from SQLite to Supabase ---');

    const client = await pgPool.connect();
    try {
        await client.query('BEGIN');

        // 1. Migrate Users
        const users = await sqliteAll('SELECT * FROM users');
        console.log(`Migrating ${users.length} user records...`);
        for (const u of users) {
            await client.query(
                `INSERT INTO public.users (id, username, password, role)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (id) DO UPDATE SET
                   username = EXCLUDED.username,
                   password = EXCLUDED.password,
                   role = EXCLUDED.role`,
                [u.id, u.username, u.password, u.role || 'user']
            );
        }
        await client.query(`SELECT setval(pg_get_serial_sequence('public.users', 'id'), COALESCE((SELECT MAX(id) FROM public.users), 1))`);

        // 2. Migrate Employees
        const employees = await sqliteAll('SELECT * FROM employees');
        console.log(`Migrating ${employees.length} employee records...`);
        for (const e of employees) {
            await client.query(
                `INSERT INTO public.employees (id, name, designation, department, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamp, CURRENT_TIMESTAMP))
                 ON CONFLICT (id) DO UPDATE SET
                   name = EXCLUDED.name,
                   designation = EXCLUDED.designation,
                   department = EXCLUDED.department,
                   status = EXCLUDED.status`,
                [e.id, e.name, e.designation || '', e.department || '', e.status || 'Active', e.created_at || null]
            );
        }
        await client.query(`SELECT setval(pg_get_serial_sequence('public.employees', 'id'), COALESCE((SELECT MAX(id) FROM public.employees), 1))`);

        // 3. Migrate Assets
        const assets = await sqliteAll('SELECT * FROM assets');
        console.log(`Migrating ${assets.length} asset records...`);
        for (const a of assets) {
            await client.query(
                `INSERT INTO public.assets (
                    id, name, serial_number, asset_tag, charger_serial, monitor_make, monitor_serial,
                    keyboard_make, mouse_make, make, model, ip_address, hostname, current_user,
                    contractual_user_name, assigned_dept, assigned_desig, employee_id, linked_asset_id,
                    status, remark, year_of_purchase, kva, warranty_expiry, last_update
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,COALESCE($25::timestamp, CURRENT_TIMESTAMP))
                 ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    serial_number = EXCLUDED.serial_number,
                    asset_tag = EXCLUDED.asset_tag,
                    charger_serial = EXCLUDED.charger_serial,
                    monitor_make = EXCLUDED.monitor_make,
                    monitor_serial = EXCLUDED.monitor_serial,
                    keyboard_make = EXCLUDED.keyboard_make,
                    mouse_make = EXCLUDED.mouse_make,
                    make = EXCLUDED.make,
                    model = EXCLUDED.model,
                    ip_address = EXCLUDED.ip_address,
                    hostname = EXCLUDED.hostname,
                    current_user = EXCLUDED.current_user,
                    contractual_user_name = EXCLUDED.contractual_user_name,
                    assigned_dept = EXCLUDED.assigned_dept,
                    assigned_desig = EXCLUDED.assigned_desig,
                    employee_id = EXCLUDED.employee_id,
                    linked_asset_id = EXCLUDED.linked_asset_id,
                    status = EXCLUDED.status,
                    remark = EXCLUDED.remark,
                    year_of_purchase = EXCLUDED.year_of_purchase,
                    kva = EXCLUDED.kva,
                    warranty_expiry = EXCLUDED.warranty_expiry`,
                [
                    a.id, a.name, a.serial_number, a.asset_tag || '', a.charger_serial || '',
                    a.monitor_make || '', a.monitor_serial || '', a.keyboard_make || '', a.mouse_make || '',
                    a.make || '', a.model || '', a.ip_address || '', a.hostname || '',
                    a.current_user || 'IT Store', a.contractual_user_name || '', a.assigned_dept || '',
                    a.assigned_desig || '', a.employee_id || null, a.linked_asset_id || null,
                    a.status || 'In Stock', a.remark || '', a.year_of_purchase || null,
                    a.kva || '', a.warranty_expiry || '', a.last_update || null
                ]
            );
        }
        await client.query(`SELECT setval(pg_get_serial_sequence('public.assets', 'id'), COALESCE((SELECT MAX(id) FROM public.assets), 1))`);

        // 4. Migrate Transactions
        const transactions = await sqliteAll('SELECT * FROM transactions');
        console.log(`Migrating ${transactions.length} transaction records...`);
        for (const t of transactions) {
            let editHistoryJson = '[]';
            if (t.edit_history) {
                try {
                    editHistoryJson = typeof t.edit_history === 'string' ? t.edit_history : JSON.stringify(t.edit_history);
                } catch (e) {
                    editHistoryJson = '[]';
                }
            }
            await client.query(
                `INSERT INTO public.transactions (
                    id, type, asset_ids, asset_names, ref_no, date, employee_name, employee_desig,
                    employee_dept, issuer_name, issuer_desig, issuer_dept, employee_id, issuer_id,
                    remark, is_protected, edit_history, last_edited_by, last_edited_at, is_deleted,
                    deleted_by, deleted_at, delete_reason, timestamp
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19::timestamp,$20,$21,$22::timestamp,$23,COALESCE($24::timestamp, CURRENT_TIMESTAMP))
                 ON CONFLICT (id) DO UPDATE SET
                    type = EXCLUDED.type,
                    asset_ids = EXCLUDED.asset_ids,
                    asset_names = EXCLUDED.asset_names,
                    ref_no = EXCLUDED.ref_no,
                    date = EXCLUDED.date,
                    employee_name = EXCLUDED.employee_name,
                    employee_desig = EXCLUDED.employee_desig,
                    employee_dept = EXCLUDED.employee_dept,
                    issuer_name = EXCLUDED.issuer_name,
                    issuer_desig = EXCLUDED.issuer_desig,
                    issuer_dept = EXCLUDED.issuer_dept,
                    employee_id = EXCLUDED.employee_id,
                    issuer_id = EXCLUDED.issuer_id,
                    remark = EXCLUDED.remark,
                    is_protected = EXCLUDED.is_protected,
                    edit_history = EXCLUDED.edit_history,
                    last_edited_by = EXCLUDED.last_edited_by,
                    last_edited_at = EXCLUDED.last_edited_at,
                    is_deleted = EXCLUDED.is_deleted,
                    deleted_by = EXCLUDED.deleted_by,
                    deleted_at = EXCLUDED.deleted_at,
                    delete_reason = EXCLUDED.delete_reason`,
                [
                    t.id, t.type, t.asset_ids || '', t.asset_names || '', t.ref_no || '', t.date || '',
                    t.employee_name || '', t.employee_desig || '', t.employee_dept || '',
                    t.issuer_name || '', t.issuer_desig || '', t.issuer_dept || '',
                    t.employee_id || null, t.issuer_id || null, t.remark || '',
                    t.is_protected || 0, editHistoryJson, t.last_edited_by || '',
                    t.last_edited_at || null, t.is_deleted || 0, t.deleted_by || '',
                    t.deleted_at || null, t.delete_reason || '', t.timestamp || null
                ]
            );
        }
        await client.query(`SELECT setval(pg_get_serial_sequence('public.transactions', 'id'), COALESCE((SELECT MAX(id) FROM public.transactions), 1))`);

        // 5. Migrate Print Logs
        const printLogs = await sqliteAll('SELECT * FROM print_logs');
        console.log(`Migrating ${printLogs.length} print_logs records...`);
        for (const p of printLogs) {
            await client.query(
                `INSERT INTO public.print_logs (
                    id, transaction_id, action_type, printed_by, printed_by_dept,
                    system_ip, system_hostname, ref_no, doc_type, print_timestamp
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::timestamp, CURRENT_TIMESTAMP))
                 ON CONFLICT (id) DO UPDATE SET
                    transaction_id = EXCLUDED.transaction_id,
                    action_type = EXCLUDED.action_type,
                    printed_by = EXCLUDED.printed_by,
                    printed_by_dept = EXCLUDED.printed_by_dept,
                    system_ip = EXCLUDED.system_ip,
                    system_hostname = EXCLUDED.system_hostname,
                    ref_no = EXCLUDED.ref_no,
                    doc_type = EXCLUDED.doc_type`,
                [
                    p.id, p.transaction_id || null, p.action_type || 'Print', p.printed_by || '',
                    p.printed_by_dept || '', p.system_ip || '', p.system_hostname || '',
                    p.ref_no || '', p.doc_type || '', p.print_timestamp || null
                ]
            );
        }
        await client.query(`SELECT setval(pg_get_serial_sequence('public.print_logs', 'id'), COALESCE((SELECT MAX(id) FROM public.print_logs), 1))`);

        await client.query('COMMIT');
        console.log('--- Migration to Supabase Successfully Completed! ---');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pgPool.end();
        sqlite.close();
    }
}

migrateData();
