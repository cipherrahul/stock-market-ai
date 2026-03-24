import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/v1/auth/register`, {
        email,
        password,
        name,
      });
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Registration failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_URL}/api/v1/auth/login`, {
        email,
        password,
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }, []);

  return { register, login, logout, loading, error };
};
