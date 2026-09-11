/** Base da API: local/Docker `/api`; na Vercel o rewrite público aponta `/api` ao serviço backend. */
export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  const backend = import.meta.env.VITE_BACKEND_URL;
  if (backend) {
    return `${String(backend).replace(/\/$/, '')}/api`;
  }
  return '/api';
}
