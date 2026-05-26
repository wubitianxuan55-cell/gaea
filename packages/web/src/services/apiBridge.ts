declare global {
  interface Window {
    __LUMI_API_BRIDGE_INSTALLED__?: boolean;
  }
}

export function getBackendOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3000';
  return window.location.origin;
}

export function getSocketOrigin(): string {
  return getBackendOrigin();
}

export function installApiBridge(): void {
  if (typeof window === 'undefined' || window.__LUMI_API_BRIDGE_INSTALLED__) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.startsWith('/')) {
      const patched: RequestInit = { ...init, credentials: 'include' };
      try {
        const storedToken = localStorage.getItem('lumi_auth_token');
        if (storedToken) {
          patched.headers = {
            ...(patched.headers as Record<string, string> || {}),
            'Authorization': `Bearer ${storedToken}`,
          };
        }
      } catch {}
      return nativeFetch(input, patched);
    }

    return nativeFetch(input, init);
  };

  window.__LUMI_API_BRIDGE_INSTALLED__ = true;
}
