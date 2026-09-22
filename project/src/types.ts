export interface Schema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface Endpoint {
  id: number;
  api_id: number;
  path: string;
  method: string;
  description?: string;
  schema?: Schema;
}

export interface ApiSpec {
  id: number;
  title: string;
  version: string;
  description?: string;
}
