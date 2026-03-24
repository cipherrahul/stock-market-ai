import { useState, useCallback } from 'react';
import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_URL,
  });

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  return client;
};

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = createApiClient();

  const get = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(url);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Request failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const post = useCallback(async (url: string, data: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post(url, data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Request failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const put = useCallback(async (url: string, data: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.put(url, data);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Request failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { get, post, put, loading, error };
};
