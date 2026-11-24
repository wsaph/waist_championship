export const STORAGE_USER_ID_KEY = 'waist_user_id';
export const STORAGE_SESSION_TOKEN_KEY = 'waist_session_token';
export const STORAGE_ACTIVE_INSTANCE_KEY = 'waist_active_instance_id';

export type SessionEvalResult = 'needs_migration' | 'valid' | 'invalid';

export function evaluateSessionMatch(
  dbToken: string | null | undefined,
  clientToken: string | null | undefined
): SessionEvalResult {
  const cleanDb = typeof dbToken === 'string' ? dbToken.trim() : '';
  const cleanClient = typeof clientToken === 'string' ? clientToken.trim() : '';
  if (!cleanDb) return 'needs_migration';
  return cleanClient.length > 0 && cleanClient === cleanDb ? 'valid' : 'invalid';
}

export function shouldClearStorageOnKick(
  storedInstanceId: string | null | undefined,
  myInstanceId: string,
  preserveOverride?: boolean
): boolean {
  if (preserveOverride) return false;
  if (!storedInstanceId) return true;
  return storedInstanceId === myInstanceId;
}

function generateRandomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

let tabInstanceId = '';
let activeUserId: number | null = null;
let activeSessionToken = '';
let sessionKickListener: ((reason: string) => void) | null = null;

export function getTabInstanceId(): string {
  if (!tabInstanceId) {
    tabInstanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return tabInstanceId;
}

export function getActiveTabUserId(): number | null {
  return activeUserId;
}

export function getActiveTabSessionToken(): string {
  return activeSessionToken;
}

export function setSessionKickListener(fn: ((reason: string) => void) | null): void {
  sessionKickListener = fn;
}

export function restoreTabSessionFromStorage(): {
  userId: number | null;
  sessionToken: string;
  instanceId: string;
} {
  const myInst = getTabInstanceId();
  if (typeof window === 'undefined') {
    return { userId: null, sessionToken: '', instanceId: myInst };
  }
  try {
    const rawUid = localStorage.getItem(STORAGE_USER_ID_KEY);
    const uid = rawUid ? Number(rawUid) : 0;
    if (!uid || Number.isNaN(uid) || uid <= 0) {
      activeUserId = null;
      activeSessionToken = '';
      return { userId: null, sessionToken: '', instanceId: myInst };
    }

    let token = (localStorage.getItem(STORAGE_SESSION_TOKEN_KEY) || '').trim();
    if (token.length < 16) {
      token = generateRandomToken();
      localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, token);
    }
    localStorage.setItem(STORAGE_ACTIVE_INSTANCE_KEY, myInst);

    activeUserId = uid;
    activeSessionToken = token;
    return { userId: uid, sessionToken: token, instanceId: myInst };
  } catch {
    activeUserId = null;
    activeSessionToken = '';
    return { userId: null, sessionToken: '', instanceId: myInst };
  }
}

export function claimBrowserSession(
  userId: number,
  sessionToken?: string
): { instanceId: string; sessionToken: string } {
  const myInst = getTabInstanceId();
  const finalToken =
    sessionToken && sessionToken.trim().length >= 16
      ? sessionToken.trim()
      : generateRandomToken();

  activeUserId = userId;
  activeSessionToken = finalToken;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_USER_ID_KEY, String(userId));
      localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, finalToken);
      localStorage.setItem(STORAGE_ACTIVE_INSTANCE_KEY, myInst);
    } catch {
      // ignore storage quota restrictions
    }
  }
  return { instanceId: myInst, sessionToken: finalToken };
}

export function updateTabSessionToken(sessionToken: string): void {
  const clean = sessionToken.trim();
  if (!clean) return;
  activeSessionToken = clean;
  if (typeof window !== 'undefined') {
    try {
      if (localStorage.getItem(STORAGE_ACTIVE_INSTANCE_KEY) === getTabInstanceId()) {
        localStorage.setItem(STORAGE_SESSION_TOKEN_KEY, clean);
      }
    } catch {
      // ignore
    }
  }
}

export function clearTabSession(opts?: { preserveLocalStorage?: boolean }): void {
  const myInst = getTabInstanceId();
  activeUserId = null;
  activeSessionToken = '';

  if (typeof window !== 'undefined') {
    try {
      const storedInst = localStorage.getItem(STORAGE_ACTIVE_INSTANCE_KEY);
      if (shouldClearStorageOnKick(storedInst, myInst, opts?.preserveLocalStorage)) {
        localStorage.removeItem(STORAGE_USER_ID_KEY);
        localStorage.removeItem(STORAGE_SESSION_TOKEN_KEY);
        localStorage.removeItem(STORAGE_ACTIVE_INSTANCE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

export function buildSessionHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (activeSessionToken) {
    headers.set('x-session-token', activeSessionToken);
  }
  return headers;
}

export async function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = buildSessionHeaders(init?.headers);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && sessionKickListener) {
    try {
      const cloned = res.clone();
      const data = await cloned.json();
      if (data?.sessionKicked) {
        sessionKickListener(
          typeof data.error === 'string' && data.error
            ? data.error
            : 'มีการเข้าสู่ระบบตัวละครนี้จากเครื่องหรือแท็บอื่น กรุณาเข้าสู่ระบบใหม่'
        );
      }
    } catch {
      // ignore non-json 401
    }
  }
  return res;
}
