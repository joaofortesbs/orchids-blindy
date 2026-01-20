import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const dbUrl = process.env.SUPABASE_DB_URL;

  if (!dbUrl) {
    console.error('Missing SUPABASE_DB_URL environment variable');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log('Connecting to Supabase database...');
    await client.connect();
    console.log('Connected successfully!');

    const migrationPath = path.join(__dirname, '..', 'migrations', '001_organizations.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('\nMigration completed successfully!');
    console.log('Tables created: organizations, organization_members, organization_invites');

  } catch (error) {
    console.error('Migration error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('\nNote: Some objects already exist, which is fine.');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
