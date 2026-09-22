import { pool } from './db';
import { ApiSpec, Endpoint, Schema } from './types';

export async function getApiSpec(id: number): Promise<ApiSpec | null> {
  const res = await pool.query('SELECT * FROM api_specs WHERE id = $1', [id]);
  return res.rows[0] || null;
}

export async function listEndpoints(apiId: number): Promise<Endpoint[]> {
  const res = await pool.query('SELECT * FROM endpoints WHERE api_id = $1', [apiId]);
  return res.rows;
}

export async function insertApiSpec(title: string, version: string, description?: string): Promise<ApiSpec> {
  const res = await pool.query(
    'INSERT INTO api_specs (title, version, description) VALUES ($1, $2, $3) RETURNING *',
    [title, version, description || null]
  );
  return res.rows[0];
}

export async function insertEndpoint(apiId: number, path: string, method: string, description?: string, schema?: Schema): Promise<Endpoint> {
  const res = await pool.query(
    'INSERT INTO endpoints (api_id, path, method, description, schema) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [apiId, path, method, description || null, schema ? JSON.stringify(schema) : null]
  );
  return res.rows[0];
}

export async function insertApiSpecFull(
  title: string,
  version: string,
  description?: string,
  endpoints?: Array<{ path: string; method: string; description?: string; schema?: Schema }>
): Promise<{ apiSpec: ApiSpec; endpoints: Endpoint[] }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const specRes = await client.query(
      'INSERT INTO api_specs (title, version, description) VALUES ($1, $2, $3) RETURNING *',
      [title, version, description || null]
    );
    const apiSpec: ApiSpec = specRes.rows[0];

    const insertedEndpoints: Endpoint[] = [];
    if (endpoints && endpoints.length > 0) {
      for (const ep of endpoints) {
        const epRes = await client.query(
          'INSERT INTO endpoints (api_id, path, method, description, schema) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [apiSpec.id, ep.path, ep.method, ep.description || null, ep.schema ? JSON.stringify(ep.schema) : null]
        );
        insertedEndpoints.push(epRes.rows[0]);
      }
    }
    await client.query('COMMIT');
    return { apiSpec, endpoints: insertedEndpoints };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function searchSpecs(query: string): Promise<ApiSpec[]> {
  const res = await pool.query(
    "SELECT * FROM api_specs WHERE title ILIKE $1 OR description ILIKE $1",
    [`%${query}%`]
  );
  return res.rows;
}
