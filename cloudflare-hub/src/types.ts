export interface Env {
  DB: D1Database;
  MAX_VERSIONS: string;
  MAX_PUSH_MB: string;
  // Rate-limit creazione repo (vars, con default se assenti).
  CREATE_MAX_PER_IP_MIN?: string;
  CREATE_MAX_PER_IP_DAY?: string;
  CREATE_MAX_GLOBAL_DAY?: string;
  // Secret (wrangler secret put)
  CREATE_SECRET?: string;
  // Turnstile opzionale: se impostato, POST /api/repos esige un token valido.
  TURNSTILE_SECRET?: string;
  PUSHER_APP_ID?: string;
  PUSHER_KEY?: string;
  PUSHER_SECRET?: string;
  PUSHER_CLUSTER?: string;
}

export type Role = 'owner' | 'member';

export interface AuthCtx {
  role: Role;
  memberId: string | null; // null => owner
}
