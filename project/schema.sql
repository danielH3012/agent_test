CREATE TABLE IF NOT EXISTS api_specs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS endpoints (
    id SERIAL PRIMARY KEY,
    api_id INTEGER NOT NULL REFERENCES api_specs(id) ON DELETE CASCADE,
    path VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    description TEXT,
    schema JSONB
);
