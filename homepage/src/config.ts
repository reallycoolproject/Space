export const getApiBaseUrl = () => {
  // 1. Check URL query param or localStorage override for instant zero-rebuild tunneling
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const queryApi = urlParams.get('api') || urlParams.get('backend');
    if (queryApi) {
      const clean = queryApi.replace(/\/$/, '');
      window.localStorage.setItem('space_api_url', clean);
      return clean;
    }
    const savedApi = window.localStorage.getItem('space_api_url');
    if (savedApi) {
      return savedApi.replace(/\/$/, '');
    }
  }

  // 2. Check environment variables
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_BASE) {
    return String(import.meta.env.VITE_API_BASE).replace(/\/$/, '');
  }

  // 3. For local development, use Vite proxy
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return '';
  }

  // 4. Default fallback for Vercel deployment to connect to active tunnel
  return 'https://volunteers-rendered-constructed-mar.trycloudflare.com';
};

export const API_BASE = getApiBaseUrl();
export const SOCKET_URL = getApiBaseUrl();
