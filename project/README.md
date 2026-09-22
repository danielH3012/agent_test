# Project DB

PostgreSQL database: `testing`

- `api_specs`: API metadata (id, title, version, description)
- `endpoints`: API paths (id, api_id FK, path, method, description, schema)
- Index: `endpoints.api_id`
