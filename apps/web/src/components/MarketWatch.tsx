'use client';

import React, { useEffect, useState } from 'react';
import apiClient from '@/utils/apiClient';
import { MarketData } from '@/types';

interface MarketWatchProps {
  symbols?: string[];
}

export const MarketWatch: React.FC<MarketWatchProps> = ({ symbols = ['RELIANCE', 'TCS', 'INFY'] }) => {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMarketData = async () => {
      try {
        for (const symbol of symbols) {
          const response = await apiClient.get(`/api/v1/market/stocks/${symbol}`);
          setMarketData((prev) => ({ ...prev, [symbol]: response.data }));
        }
      } catch (error) {
        console.error('Failed to load market data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMarketData();
    const interval = setInterval(loadMarketData, 5000);
    return () => clearInterval(interval);
  }, [symbols]);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">Market Watch</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700 text-gray-300 text-sm">
              <th className="px-6 py-3 text-left">Symbol</th>
              <th className="px-6 py-3 text-left">Price</th>
              <th className="px-6 py-3 text-left">Change</th>
              <th className="px-6 py-3 text-left">Volume</th>
              <th className="px-6 py-3 text-left">Bid/Ask</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : (
              Object.entries(marketData).map(([symbol, data]) => (
                <tr key={symbol} className="border-t border-gray-700 hover:bg-gray-700/50">
                  <td className="px-6 py-3 font-semibold text-white">{symbol}</td>
                  <td className="px-6 py-3 text-white">${data.price.toFixed(2)}</td>
                  <td
                    className={`px-6 py-3 ${
                      data.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {data.change >= 0 ? '+' : ''}
                    {data.change.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-gray-400">{data.volume.toLocaleString()}</td>
                  <td className="px-6 py-3 text-gray-400">
                    {data.bid.toFixed(2)} / {data.ask.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
