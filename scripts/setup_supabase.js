const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const projectRefs = ['brrvhjqgvywceiymngde', 'brrvhjggvywceiymngde'];
const regions = ['ap-south-1', 'us-east-1', 'eu-central-1', 'ap-southeast-1', 'eu-west-1', 'us-west-1'];
const ports = [6543, 5432];
const pass = 'Zahid%40261601';

async function tryConnect(connString, label) {
    const client = new Client({
        connectionString: connString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });
    try {
        await client.connect();
        console.log(`\nSUCCESS! Connected to Supabase PostgreSQL (${label})!`);
        return { client, connString };
    } catch (err) {
        process.stdout.write('.');
        try { await client.end(); } catch (e) {}
        return null;
    }
}

async function runSetup() {
    console.log('Testing Supabase pooler connection endpoints...');
    let connObj = null;

    for (const ref of projectRefs) {
        for (const region of regions) {
            for (const port of ports) {
                // Session/Transaction Pooler format: postgres.[ref] @ aws-0-[region].pooler.supabase.com:[port]
                const poolerUri = `postgresql://postgres.${ref}:${pass}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
                connObj = await tryConnect(poolerUri, `${ref} (${region}:${port})`);
                if (connObj) break;
            }
            if (connObj) break;
        }
        if (connObj) break;
    }

    if (!connObj) {
        // Direct host test fallback
        for (const ref of projectRefs) {
            const directUri = `postgresql://postgres:${pass}@db.${ref}.supabase.co:5432/postgres`;
            connObj = await tryConnect(directUri, `${ref} (Direct)`);
            if (connObj) break;
        }
    }

    if (!connObj) {
        console.error('\nERROR: Could not connect to Supabase database.');
        process.exit(1);
    }

    const { client, connString } = connObj;

    try {
        console.log('\n--- Step 1: Executing DDL Schema (supabase_schema.sql) ---');
        const schemaPath = path.resolve(__dirname, '..', 'supabase_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        await client.query(schemaSql);
        console.log('Successfully created all tables, indexes, and triggers in Supabase!');

        // Save active configuration to .env
        const envPath = path.resolve(__dirname, '..', '.env');
        const envContent = `PORT=3000
NODE_ENV=production
JWT_SECRET=aai_vabo_super_secret_jwt_key_2026

# Active Database Configuration (Supabase PostgreSQL)
DB_TYPE=supabase
DATABASE_URL=${connString}
SUPABASE_URL=https://brrvhjqgvywceiymngde.supabase.co
`;
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log('Updated .env file with active Supabase connection string!');

    } catch (err) {
        console.error('\nSetup failed:', err.message);
    } finally {
        await client.end();
    }
}

runSetup();
