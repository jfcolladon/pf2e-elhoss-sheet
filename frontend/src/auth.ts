const STORAGE_KEY = "elhoss-basic-auth";

export function getAuthHeader(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuth(user: string, password: string): void {
  const token = btoa(`${user}:${password}`);
  sessionStorage.setItem(STORAGE_KEY, `Basic ${token}`);
}

export function clearAuth(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasStoredAuth(): boolean {
  return Boolean(getAuthHeader());
}
