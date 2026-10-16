export interface Env {
  DB: D1Database;
  MAX_VERSIONS: string;
  MAX_PUSH_MB: string;
  CREATE_MAX_PER_IP_MIN?: string;
  CREATE_MAX_PER_IP_DAY?: string;
  CREATE_MAX_GLOBAL_DAY?: string;
  CREATE_SECRET?: string;
  TURNSTILE_SECRET?: string;
  PUSHER_APP_ID?: string;
  PUSHER_KEY?: string;
  PUSHER_SECRET?: string;
  PUSHER_CLUSTER?: string;
  PUSHER_HOST?: string;
}

export type Role = 'owner' | 'member';

export interface AuthCtx {
  role: Role;
  memberId: string | null;
}
