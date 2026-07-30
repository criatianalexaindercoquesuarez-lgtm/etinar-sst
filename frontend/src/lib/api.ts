import axios from 'axios';

// En desarrollo local, Vite redirige /api al backend (ver vite.config.ts).
// En producción (Render, Vercel, etc.) no hay proxy: se usa la URL pública
// real del backend, configurada en el build como VITE_API_URL.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('etinar_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('etinar_token');
      localStorage.removeItem('etinar_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'coordinador_sst' | 'director' | 'contratista';
  contractorId: string | null;
}
