// Bindings available to the Pages Functions (configured in wrangler.toml / dashboard).
export interface Env {
  WORDLE_KV: KVNamespace;
  JWT_SECRET?: string;
}
