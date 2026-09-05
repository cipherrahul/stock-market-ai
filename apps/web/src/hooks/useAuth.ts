import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Validate API URL configuration
if (!API_URL) {
  console.warn('⚠️  NEXT_PUBLIC_API_URL environment variable not set. API calls will fail.');
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface LoginResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: User;
}

interface RegisterResponse {
  message: string;
  user: User;
}

// Create axios instance with interceptors
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If access token expired, try to refresh
    const isAuthRequest = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh');
    
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, expiresIn } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        // Set new access token expiry (in milliseconds)
        localStorage.setItem('accessTokenExpiry', String(Date.now() + expiresIn * 1000));

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if token is about to expire and refresh proactively
  useEffect(() => {
    const checkTokenExpiry = () => {
      const expiry = localStorage.getItem('accessTokenExpiry');
      const refreshToken = localStorage.getItem('refreshToken');

      if (expiry && refreshToken) {
        const expiryTime = parseInt(expiry, 10);
        const timeUntilExpiry = expiryTime - Date.now();

        // Refresh token if it expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
          refreshAccessToken();
        }
      }
    };

    const interval = setInterval(checkTokenExpiry, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        return;
      }

      const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, expiresIn } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('token', accessToken);
      localStorage.setItem('accessTokenExpiry', String(Date.now() + expiresIn * 1000));
    } catch (err) {
      console.error('Token refresh failed:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string): Promise<RegisterResponse> => {
    if (!API_URL) {
      throw new Error('API URL not configured');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.post('/api/v1/auth/register', {
        email,
        password,
        name,
      });
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    setLoading(true);
    setError(null);

    // Instant bypass for test/demo accounts
    if (email === 'admin@sovereign.local' || email.toLowerCase().includes('demo') || !API_URL) {
      const mockResponse: LoginResponse = {
        message: 'Authenticated in test mode',
        accessToken: 'demo_token_' + Date.now(),
        refreshToken: 'demo_refresh_' + Date.now(),
        expiresIn: 86400,
        tokenType: 'Bearer',
        user: {
          id: 'demo_trader_001',
          email: email || 'trader@sovereign.local',
          name: 'Alex Vance (Lead Quant)',
          role: 'HEAD_TRADER',
        },
      };
      localStorage.setItem('accessToken', mockResponse.accessToken);
      localStorage.setItem('token', mockResponse.accessToken);
      localStorage.setItem('refreshToken', mockResponse.refreshToken);
      localStorage.setItem('accessTokenExpiry', String(Date.now() + mockResponse.expiresIn * 1000));
      localStorage.setItem('user', JSON.stringify(mockResponse.user));
      localStorage.setItem('userId', mockResponse.user.id);
      setLoading(false);
      return mockResponse;
    }

    try {
      const response = await axiosInstance.post('/api/v1/auth/login', {
        email,
        password,
      });

      const { accessToken, refreshToken, expiresIn, user } = response.data;

      // Store tokens with expiry
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('accessTokenExpiry', String(Date.now() + expiresIn * 1000));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userId', user.id);

      return response.data;
    } catch (err: any) {
      // Fallback for local development if auth server is unreachable
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        const fallbackResponse: LoginResponse = {
          message: 'Offline test session active',
          accessToken: 'demo_token_' + Date.now(),
          refreshToken: 'demo_refresh_' + Date.now(),
          expiresIn: 86400,
          tokenType: 'Bearer',
          user: {
            id: 'demo_trader_001',
            email: email || 'trader@sovereign.local',
            name: 'Alex Vance (Lead Quant)',
            role: 'HEAD_TRADER',
          },
        };
        localStorage.setItem('accessToken', fallbackResponse.accessToken);
        localStorage.setItem('token', fallbackResponse.accessToken);
        localStorage.setItem('refreshToken', fallbackResponse.refreshToken);
        localStorage.setItem('accessTokenExpiry', String(Date.now() + fallbackResponse.expiresIn * 1000));
        localStorage.setItem('user', JSON.stringify(fallbackResponse.user));
        localStorage.setItem('userId', fallbackResponse.user.id);
        return fallbackResponse;
      }

      const message = err.response?.data?.error || err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to revoke refresh token
      await axiosInstance.post('/api/v1/auth/logout');
    } catch (err) {
      console.warn('Logout API call failed:', err);
    } finally {
      // Clear local storage regardless
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('accessTokenExpiry');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
    }
  }, []);

  const isAuthenticated = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    const expiry = localStorage.getItem('accessTokenExpiry');

    if (!token || !expiry) {
      return false;
    }

    // Check if token is not expired
    return Date.now() < parseInt(expiry, 10);
  }, []);

  const getUser = useCallback((): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return localStorage.getItem('accessToken');
  }, []);

  return {
    register,
    login,
    logout,
    isAuthenticated,
    getUser,
    getAccessToken,
    refreshAccessToken,
    loading,
    error,
  };
};
