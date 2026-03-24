'use client';

import React, { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import toast from 'react-hot-toast';

export const TradingPanel: React.FC = () => {
  const { post, loading } = useApi();
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error('User not authenticated');
      return;
    }

    try {
      await post('/api/v1/trading/execute', {
        userId,
        symbol: symbol.toUpperCase(),
        quantity: parseInt(quantity),
        price: parseFloat(price),
        side,
      });

      toast.success(`${side} order placed successfully!`);
      setSymbol('');
      setQuantity('');
      setPrice('');
    } catch (error) {
      toast.error('Failed to execute trade');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Execute Trade</h2>

      <form onSubmit={handleExecute} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g., RELIANCE"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Price</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Side</label>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full px-4 py-2 rounded font-semibold text-white transition ${
            side === 'BUY'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          } disabled:opacity-50`}
        >
          {loading ? 'Executing...' : `Place ${side} Order`}
        </button>
      </form>
    </div>
  );
};
