export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_BASE) {
    return String(import.meta.env.VITE_API_BASE).replace(/\/$/, '');
  }
  // For local development, use Vite proxy
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '';
  }

  // For production, use relative path (same domain)
  return '';
};

export const API_BASE = getApiBaseUrl();
export const SOCKET_URL = getApiBaseUrl();
