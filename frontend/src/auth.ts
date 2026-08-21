const BASIC_KEY = "elhoss-basic-auth";
const BEARER_KEY = "elhoss-bearer-auth";

export function getAuthHeader(): string | null {
  try {
    return sessionStorage.getItem(BEARER_KEY) || sessionStorage.getItem(BASIC_KEY);
  } catch {
    return null;
  }
}

export function setAuth(user: string, password: string): void {
  const token = btoa(`${user}:${password}`);
  sessionStorage.setItem(BASIC_KEY, `Basic ${token}`);
  sessionStorage.removeItem(BEARER_KEY);
}

export function setBearer(token: string): void {
  sessionStorage.setItem(BEARER_KEY, `Bearer ${token}`);
  sessionStorage.removeItem(BASIC_KEY);
}

export function clearAuth(): void {
  sessionStorage.removeItem(BASIC_KEY);
  sessionStorage.removeItem(BEARER_KEY);
}

export function hasStoredAuth(): boolean {
  return Boolean(getAuthHeader());
}
