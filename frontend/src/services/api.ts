import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { getApiBaseUrl } from './apiBase';

const apiBaseUrl = getApiBaseUrl();
const REFRESH_TIMEOUT_MS = 15_000;

function forceLogout() {
  useAuthStore.getState().logout();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

function isAuthHandshake(url?: string) {
  const path = url || '';
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/forgot-password')
  );
}

function isHtmlContentType(headers: unknown) {
  const h = (headers || {}) as Record<string, unknown>;
  const contentType = String(h['content-type'] || h['Content-Type'] || '');
  return contentType.includes('text/html');
}

function apiUnavailableError() {
  return Object.assign(new Error('API indisponível'), {
    response: {
      status: 503,
      data: { message: 'Servidor da API não respondeu. Tente de novo em instantes.' },
    },
  });
}

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (isHtmlContentType(response.headers)) {
      return Promise.reject(apiUnavailableError());
    }
    return response;
  },
  async (error) => {
    if (isHtmlContentType(error.response?.headers)) {
      return Promise.reject(apiUnavailableError());
    }

    const originalRequest = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthHandshake(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        forceLogout();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(
          `${apiBaseUrl}/auth/refresh`,
          { refreshToken },
          { timeout: REFRESH_TIMEOUT_MS }
        );
        useAuthStore.getState().setTokens(data.data.accessToken, refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch {
        forceLogout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
