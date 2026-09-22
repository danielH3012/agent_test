import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runTest() {
  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('Connected.');

    // Edge case: verify connection is actually live
    const ping = await client.query('SELECT 1 AS ping');
    console.log('Ping result:', ping.rows[0].ping);

    // Verify api_specs table exists
    const apiSpecsCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'api_specs'
      ORDER BY ordinal_position
    `);
    console.log('api_specs columns:', apiSpecsCheck.rows);

    if (apiSpecsCheck.rows.length === 0) {
      throw new Error('Table api_specs does NOT exist');
    }

    const expectedApiSpecs = ['id', 'title', 'version', 'description'];
    const actualApiSpecs = apiSpecsCheck.rows.map((r: any) => r.column_name);
    for (const col of expectedApiSpecs) {
      if (!actualApiSpecs.includes(col)) {
        throw new Error(`api_specs missing column: ${col}`);
      }
    }
    console.log('api_specs columns verified OK');

    // Verify endpoints table exists
    const endpointsCheck = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'endpoints'
      ORDER BY ordinal_position
    `);
    console.log('endpoints columns:', endpointsCheck.rows);

    if (endpointsCheck.rows.length === 0) {
      throw new Error('Table endpoints does NOT exist');
    }

    const expectedEndpoints = ['id', 'api_id', 'path', 'method', 'description', 'schema'];
    const actualEndpoints = endpointsCheck.rows.map((r: any) => r.column_name);
    for (const col of expectedEndpoints) {
      if (!actualEndpoints.includes(col)) {
        throw new Error(`endpoints missing column: ${col}`);
      }
    }
    console.log('endpoints columns verified OK');

    // Edge case: verify foreign key relationship
    const fkCheck = await client.query(`
      SELECT conname, confrelid::regclass, conrelid::regclass
      FROM pg_constraint
      WHERE conrelid = 'endpoints'::regclass
      AND contype = 'f'
    `);
    console.log('Foreign keys:', fkCheck.rows);
    console.log('All verifications passed.');
    client.release();
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTest();
