import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  // Using connection string format for session pooler
  const connectionString = 'postgresql://postgres.ynxeyaqdhihjxwajualk:Joaomarcelo%2373@aws-1-us-east-2.pooler.supabase.com:5432/postgres';
  
  const client = new pg.Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase via Session Pooler...');
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
  } finally {
    await client.end();
  }
}

runMigration();
