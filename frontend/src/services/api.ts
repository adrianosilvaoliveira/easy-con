import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { getApiBaseUrl } from './apiBase';

const apiBaseUrl = getApiBaseUrl();
const REFRESH_TIMEOUT_MS = 15_000;

function forceLogout() {
  useAuthStore.getState().logout();
  window.location.href = '/login';
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
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
