const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DEFAULT_DB_PATH = path.resolve(__dirname, '..', 'database.db');
const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || DEFAULT_DB_PATH);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const rawDb = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Failed to open SQLite database:', err.message);
    } else {
        rawDb.run('PRAGMA foreign_keys = ON;');
    }
});

function normalizeArgs(params, callback) {
    if (typeof params === 'function') {
        return { params: [], callback: params };
    }

    if (typeof callback === 'function') {
        if (Array.isArray(params)) {
            return { params, callback };
        }
        if (params === undefined || params === null) {
            return { params: [], callback };
        }
        return { params: [params], callback };
    }

    return {
        params: Array.isArray(params) ? params : (params === undefined || params === null ? [] : [params]),
        callback: () => {}
    };
}

const txQueue = [];
let isTxActive = false;

function processTxQueue() {
    if (isTxActive || txQueue.length === 0) return;
    isTxActive = true;
    const nextTx = txQueue.shift();
    rawDb.run('BEGIN TRANSACTION', function (err) {
        if (err) {
            isTxActive = false;
            if (typeof nextTx.callback === 'function') {
                try {
                    nextTx.callback.call(this, err);
                } catch (cbErr) {
                    console.error('Error in beginTransaction callback:', cbErr);
                }
            }
            processTxQueue();
        } else {
            if (typeof nextTx.callback === 'function') {
                try {
                    nextTx.callback.call(this, null);
                } catch (cbErr) {
                    console.error('Error in beginTransaction callback:', cbErr);
                    endTransaction('ROLLBACK', () => {});
                }
            }
        }
    });
}

function beginTransaction(callback) {
    txQueue.push({ callback: typeof callback === 'function' ? callback : () => {} });
    processTxQueue();
}

function endTransaction(type, callback) {
    rawDb.run(type, function (err) {
        isTxActive = false;
        if (typeof callback === 'function') {
            callback.call(this, err);
        }
        processTxQueue();
    });
}

function commit(callback) {
    return endTransaction('COMMIT', callback);
}

function rollback(callback) {
    return endTransaction('ROLLBACK', callback);
}

function run(query, params, callback) {
    const normalized = normalizeArgs(params, callback);
    const trimmed = typeof query === 'string' ? query.trim().toUpperCase() : '';
    if (trimmed === 'BEGIN TRANSACTION' || trimmed === 'BEGIN') {
        return beginTransaction(normalized.callback);
    }
    if (trimmed === 'COMMIT') {
        return commit(normalized.callback);
    }
    if (trimmed === 'ROLLBACK') {
        return rollback(normalized.callback);
    }
    rawDb.run(query, ...normalized.params, function (err) {
        normalized.callback.call(this, err);
    });
}

function get(query, params, callback) {
    const normalized = normalizeArgs(params, callback);
    rawDb.get(query, ...normalized.params, (err, row) => {
        normalized.callback(err, row);
    });
}

function all(query, params, callback) {
    const normalized = normalizeArgs(params, callback);
    rawDb.all(query, ...normalized.params, (err, rows) => {
        normalized.callback(err, rows);
    });
}

const db = {
    run,
    get,
    all,
    beginTransaction,
    commit,
    rollback,
    prepare: rawDb.prepare.bind(rawDb),
    serialize: rawDb.serialize.bind(rawDb),
    close: rawDb.close.bind(rawDb),
    exec: rawDb.exec.bind(rawDb)
};

function initializeDatabase() {
    const schema = `
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user'
        );

        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            serial_number TEXT NOT NULL UNIQUE,
            asset_tag TEXT DEFAULT '',
            charger_serial TEXT DEFAULT '',
            monitor_make TEXT DEFAULT '',
            monitor_serial TEXT DEFAULT '',
            keyboard_make TEXT DEFAULT '',
            mouse_make TEXT DEFAULT '',
            make TEXT DEFAULT '',
            model TEXT DEFAULT '',
            ip_address TEXT DEFAULT '',
            hostname TEXT DEFAULT '',
            current_user TEXT DEFAULT 'IT Store',
            contractual_user_name TEXT DEFAULT '',
            assigned_dept TEXT DEFAULT '',
            assigned_desig TEXT DEFAULT '',
            employee_id INTEGER DEFAULT NULL,
            linked_asset_id INTEGER DEFAULT NULL,
            status TEXT DEFAULT 'In Stock',
            remark TEXT DEFAULT '',
            year_of_purchase INTEGER DEFAULT NULL,
            kva TEXT DEFAULT '',
            warranty_expiry TEXT DEFAULT '',
            last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            asset_ids TEXT NOT NULL,
            asset_names TEXT DEFAULT '',
            ref_no TEXT DEFAULT '',
            date TEXT DEFAULT '',
            employee_name TEXT NOT NULL,
            employee_desig TEXT DEFAULT '',
            employee_dept TEXT DEFAULT '',
            issuer_name TEXT DEFAULT '',
            issuer_desig TEXT DEFAULT '',
            issuer_dept TEXT DEFAULT '',
            employee_id INTEGER DEFAULT NULL,
            issuer_id INTEGER DEFAULT NULL,
            remark TEXT DEFAULT '',
            is_protected INTEGER DEFAULT 0,
            edit_history TEXT DEFAULT '[]',
            last_edited_by TEXT DEFAULT '',
            last_edited_at DATETIME DEFAULT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (issuer_id) REFERENCES employees(id)
        );

        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            designation TEXT DEFAULT '',
            department TEXT DEFAULT '',
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS print_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER,
            action_type TEXT NOT NULL DEFAULT 'Print',
            printed_by TEXT NOT NULL DEFAULT '',
            printed_by_dept TEXT DEFAULT '',
            system_ip TEXT DEFAULT '',
            system_hostname TEXT DEFAULT '',
            ref_no TEXT DEFAULT '',
            doc_type TEXT DEFAULT '',
            print_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_assets_last_update ON assets(last_update DESC);
        CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name);
        CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(asset_tag);
        CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
        CREATE INDEX IF NOT EXISTS idx_print_logs_tx ON print_logs(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_print_logs_ts ON print_logs(print_timestamp DESC);
    `;

    return new Promise((resolve, reject) => {
        const continueInit = () => resolve();
        rawDb.serialize(() => {
            rawDb.exec(schema, (schemaErr) => {
                if (schemaErr) {
                    return reject(schemaErr);
                }

                // Seed employees from existing assets and transactions if empty
                rawDb.get('SELECT COUNT(*) as count FROM employees', [], (err, row) => {
                    if (!err && row.count === 0) {
                        const seedSql = `
                            INSERT OR IGNORE INTO employees (name, designation, department)
                            SELECT DISTINCT current_user, assigned_desig, assigned_dept FROM assets 
                            WHERE current_user IS NOT NULL AND current_user != '' AND current_user != 'IT Store'
                            UNION
                            SELECT DISTINCT employee_name, employee_desig, employee_dept FROM transactions
                            WHERE employee_name IS NOT NULL AND employee_name != ''
                        `;
                        rawDb.run(seedSql, [], (seedErr) => {
                            if (seedErr) console.error('Failed to seed employees:', seedErr.message);
                            else console.log('Successfully seeded employees from existing data.');
                        });
                    }
                });

                rawDb.all('PRAGMA table_info(assets)', (pragmaErr, columns) => {
                    if (pragmaErr) return reject(pragmaErr);

                    const hasHostname = columns.some(c => c.name === 'hostname');
                    const hasYear     = columns.some(c => c.name === 'year_of_purchase');

                    // Migrate transactions table — add issuer_desig/issuer_dept if missing
                    rawDb.all('PRAGMA table_info(transactions)', (tErr, tCols) => {
                        if (!tErr) {
                            const names = tCols.map(c => c.name);
                            if (!names.includes('issuer_desig')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN issuer_desig TEXT DEFAULT ''`);
                            }
                            if (!names.includes('issuer_dept')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN issuer_dept TEXT DEFAULT ''`);
                            }
                            if (!names.includes('edit_history')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN edit_history TEXT DEFAULT '[]'`);
                            }
                            if (!names.includes('last_edited_by')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN last_edited_by TEXT DEFAULT ''`);
                            }
                            if (!names.includes('last_edited_at')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN last_edited_at DATETIME`);
                            }
                            if (!names.includes('is_deleted')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN is_deleted INTEGER DEFAULT 0`);
                            }
                            if (!names.includes('deleted_by')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN deleted_by TEXT DEFAULT ''`);
                            }
                            if (!names.includes('deleted_at')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN deleted_at DATETIME`);
                            }
                            if (!names.includes('delete_reason')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN delete_reason TEXT DEFAULT ''`);
                            }
                            if (!names.includes('remark')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN remark TEXT DEFAULT ''`);
                            }
                            if (!names.includes('employee_id')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN employee_id INTEGER REFERENCES employees(id)`);
                            }
                            if (!names.includes('issuer_id')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN issuer_id INTEGER REFERENCES employees(id)`);
                            }
                            if (!names.includes('is_protected')) {
                                rawDb.run(`ALTER TABLE transactions ADD COLUMN is_protected INTEGER DEFAULT 0`);
                            }
                        }
                    });

                    // Add missing columns to assets table
                    rawDb.all('PRAGMA table_info(assets)', (aErr, aCols) => {
                        if (!aErr) {
                            const names = aCols.map(c => c.name);
                            const newCols = [
                                'employee_id', 'asset_tag', 'contractual_user_name',
                                'linked_asset_id', 'keyboard_make', 'mouse_make',
                                'kva', 'warranty_expiry'
                            ];
                            newCols.forEach(col => {
                                if (!names.includes(col)) {
                                    let defaultVal = "TEXT DEFAULT ''";
                                    if (col === 'employee_id' || col === 'linked_asset_id') {
                                        defaultVal = 'INTEGER DEFAULT NULL';
                                    }
                                    rawDb.run(`ALTER TABLE assets ADD COLUMN ${col} ${defaultVal}`);
                                }
                            });
                        }
                    });

                    // Perform data migration: link names to IDs
                    const migrateData = () => {
                        return new Promise((migrateResolve) => {
                            rawDb.serialize(() => {
                                // 1. Populate employees from assets/transactions if they don't exist
                                const seedSql = `
                                    INSERT OR IGNORE INTO employees (name, designation, department)
                                    SELECT DISTINCT current_user, assigned_desig, assigned_dept FROM assets 
                                    WHERE current_user IS NOT NULL AND current_user != '' AND current_user != 'IT Store'
                                    UNION
                                    SELECT DISTINCT employee_name, employee_desig, employee_dept FROM transactions
                                    WHERE employee_name IS NOT NULL AND employee_name != ''
                                    UNION
                                    SELECT DISTINCT issuer_name, issuer_desig, issuer_dept FROM transactions
                                    WHERE issuer_name IS NOT NULL AND issuer_name != ''
                                `;
                                rawDb.run(seedSql, [], (seedErr) => {
                                    if (seedErr) console.error('Migration: Seed employees failed:', seedErr.message);
                                    
                                    // 2. Link assets.employee_id
                                    rawDb.run(`
                                        UPDATE assets 
                                        SET employee_id = (SELECT id FROM employees WHERE employees.name = assets.current_user)
                                        WHERE employee_id IS NULL AND current_user != 'IT Store'
                                    `);

                                    // 3. Link transactions.employee_id
                                    rawDb.run(`
                                        UPDATE transactions 
                                        SET employee_id = (SELECT id FROM employees WHERE employees.name = transactions.employee_name)
                                        WHERE employee_id IS NULL
                                    `);

                                    // 4. Link transactions.issuer_id
                                    rawDb.run(`
                                        UPDATE transactions 
                                        SET issuer_id = (SELECT id FROM employees WHERE employees.name = transactions.issuer_name)
                                        WHERE issuer_id IS NULL
                                    `);

                                    rawDb.exec(`
                                        CREATE INDEX IF NOT EXISTS idx_assets_employee_id ON assets(employee_id);
                                        CREATE INDEX IF NOT EXISTS idx_transactions_employee_id ON transactions(employee_id);
                                        CREATE INDEX IF NOT EXISTS idx_print_logs_tx ON print_logs(transaction_id);
                                        CREATE INDEX IF NOT EXISTS idx_print_logs_ts ON print_logs(print_timestamp DESC);
                                        CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(asset_tag);
                                    `);
                                    console.log('Database migration (ID linking) completed.');
                                    migrateResolve();
                                });
                            });
                        });
                    };

                    migrateData().then(() => {
                        continueInit();
                    });

                    function addYear() {
                        rawDb.run('ALTER TABLE assets ADD COLUMN year_of_purchase INTEGER DEFAULT NULL', (alterErr) => {
                            if (alterErr) return reject(alterErr);
                            continueInit();
                        });
                    }

                    if (!hasHostname) {
                        rawDb.run(`ALTER TABLE assets ADD COLUMN hostname TEXT DEFAULT ''`, (alterErr) => {
                            if (alterErr) return reject(alterErr);
                            if (hasYear) continueInit();
                            else addYear();
                        });
                    } else {
                        if (!hasYear) addYear();
                        else continueInit();
                    }
                });
            });
        });
    });
}

module.exports = { db, initializeDatabase, DB_PATH };
