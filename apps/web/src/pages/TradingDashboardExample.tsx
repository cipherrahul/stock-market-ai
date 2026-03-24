/**
 * EXAMPLE: Complete Trading Dashboard Page
 * Demonstrates:
 * - Real-time price feed
 * - Trading panel with buy/sell
 * - Order history stream
 * - Portfolio updates
 * - AI signals
 * - Risk monitoring
 */

import React, { useState, useCallback } from 'react';
import { TradingPanel } from '@/components/TradingPanelRealtime';
import { PriceTicker } from '@/components/PriceTicker';
import { PortfolioDashboard } from '@/components/PortfolioDashboard';
import { useRealtimePrice, useRealtimeOrders, useRealtimeSignals } from '@/hooks/useRealtime';

export default function TradingDashboard() {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  // State
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [tradedSymbols, setTradedSymbols] = useState<Set<string>>(new Set(['RELIANCE', 'TCS', 'INFY']));

  // Real-time hooks
  const { prices, connected: pricesConnected } = useRealtimePrice(token);
  const { orders, connected: ordersConnected } = useRealtimeOrders(token);
  const { signals, connected: signalsConnected } = useRealtimeSignals(token);

  // Handle trade execution
  const handleTradeExecuted = useCallback((trade: any) => {
    // Add symbol to watched list
    setTradedSymbols(prev => new Set([...prev, trade.symbol]));
    
    // Show notification
    console.log(`✅ Trade executed: ${trade.side} ${trade.quantity} ${trade.symbol}`);
    
    // Could trigger:
    // - Refresh portfolio
    // - Play sound notification
    // - Update charts
    // - Send analytics event
  }, []);

  if (!token || !userId) {
    return <div>Please login first</div>;
  }

  const symbolsList = Array.from(tradedSymbols);

  return (
    <div className="trading-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <h1>📊 Trading Dashboard</h1>
        <div className="header-stats">
          <div className={`stat ${pricesConnected ? 'connected' : 'disconnected'}`}>
            💰 Prices: {pricesConnected ? '🟢 Live' : '⚫ Offline'}
          </div>
          <div className={`stat ${ordersConnected ? 'connected' : 'disconnected'}`}>
            📈 Orders: {ordersConnected ? '🟢 Live' : '⚫ Offline'}
          </div>
          <div className={`stat ${signalsConnected ? 'connected' : 'disconnected'}`}>
            🤖 Signals: {signalsConnected ? '🟢 Live' : '⚫ Offline'}
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        {/* Left Column: Trading Panel & Prices */}
        <div className="left-column">
          {/* Trading Panel */}
          <section className="dashboard-section">
            <TradingPanel
              token={token}
              userId={userId}
              defaultSymbol={selectedSymbol}
              onTradeExecuted={handleTradeExecuted}
            />
          </section>

          {/* Current Price Details */}
          <section className="dashboard-section">
            <h3>💹 {selectedSymbol} Details</h3>
            {prices.get(selectedSymbol) ? (
              <div className="price-details">
                <div className="detail-row">
                  <span>Current Price:</span>
                  <span className="value">₹{prices.get(selectedSymbol)!.price.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span>Bid:</span>
                  <span>₹{prices.get(selectedSymbol)!.bid.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span>Ask:</span>
                  <span>₹{prices.get(selectedSymbol)!.ask.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span>Change:</span>
                  <span className={prices.get(selectedSymbol)!.change >= 0 ? 'positive' : 'negative'}>
                    {prices.get(selectedSymbol)!.change >= 0 ? '+' : ''}
                    {prices.get(selectedSymbol)!.changePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="detail-row">
                  <span>Volume:</span>
                  <span>{(prices.get(selectedSymbol)!.volume / 1000000).toFixed(2)}M</span>
                </div>
              </div>
            ) : (
              <div className="loading">Loading price data...</div>
            )}
          </section>

          {/* AI Signal */}
          <section className="dashboard-section">
            <h3>🤖 AI Signal</h3>
            {signals.get(selectedSymbol) ? (
              <div className={`signal-card ${signals.get(selectedSymbol)!.signal.toLowerCase()}`}>
                <div className="signal-type">
                  {signals.get(selectedSymbol)!.signal}
                </div>
                <div className="signal-confidence">
                  Confidence: {signals.get(selectedSymbol)!.confidence.toFixed(0)}%
                </div>
                <div className="signal-reasoning">
                  {signals.get(selectedSymbol)!.reasoning}
                </div>
              </div>
            ) : (
              <div className="loading">Loading AI signal...</div>
            )}
          </section>
        </div>

        {/* Middle Column: Price Ticker */}
        <div className="middle-column">
          <section className="dashboard-section">
            <h3>📊 Watchlist</h3>
            <PriceTicker
              symbols={symbolsList}
              token={token}
            />
            
            <div className="add-symbol">
              <input
                type="text"
                placeholder="Add symbol..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    const symbol = input.value.toUpperCase();
                    if (symbol) {
                      setTradedSymbols(prev => new Set([...prev, symbol]));
                      input.value = '';
                    }
                  }
                }}
              />
              <small>Press Enter to add</small>
            </div>
          </section>

          {/* Recent Orders */}
          <section className="dashboard-section">
            <h3>📝 Recent Orders</h3>
            <div className="orders-list">
              {orders.length > 0 ? (
                orders.slice(0, 5).map((order) => (
                  <div key={order.orderId} className={`order-item status-${order.status.toLowerCase()}`}>
                    <div className="order-header">
                      <span className="order-id">#{order.orderId.slice(0, 8)}</span>
                      <span className={`status ${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </div>
                    {order.executedPrice && (
                      <div className="order-details">
                        <span>₹{order.executedPrice.toFixed(2)}</span>
                        <span className="time">
                          {new Date(order.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty">No recent orders</div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Portfolio */}
        <div className="right-column">
          <section className="dashboard-section full-height">
            <PortfolioDashboard
              token={token}
              userId={userId}
            />
          </section>
        </div>
      </div>

      <style jsx>{`
        .trading-dashboard {
          padding: 20px;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          min-height: 100vh;
        }

        .dashboard-header {
          background: white;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .dashboard-header h1 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 28px;
        }

        .header-stats {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .stat {
          padding: 10px 15px;
          background: #f0f0f0;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }

        .stat.connected {
          background: #c8e6c9;
          color: #2e7d32;
        }

        .dashboard-layout {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .dashboard-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .dashboard-section h3 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 16px;
        }

        .full-height {
          grid-row: 1 / -1;
        }

        .price-details {
          display: grid;
          gap: 12px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 14px;
        }

        .detail-row .value {
          font-weight: bold;
          color: #333;
        }

        .detail-row .positive {
          color: #4caf50;
        }

        .detail-row .negative {
          color: #f44336;
        }

        .signal-card {
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid;
          background: #f5f5f5;
        }

        .signal-card.buy {
          border-left-color: #4caf50;
          background: #c8e6c9;
        }

        .signal-card.sell {
          border-left-color: #f44336;
          background: #ffcdd2;
        }

        .signal-card.hold {
          border-left-color: #ff9800;
          background: #ffe0b2;
        }

        .signal-type {
          font-size: 18px;
          font-weight: bold;
          color: #333;
          margin-bottom: 8px;
        }

        .signal-confidence {
          font-size: 12px;
          color: #666;
          margin-bottom: 8px;
        }

        .signal-reasoning {
          font-size: 12px;
          line-height: 1.5;
          color: #666;
        }

        .add-symbol {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }

        .add-symbol input {
          padding: 10px;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
        }

        .add-symbol small {
          color: #999;
          font-size: 12px;
        }

        .orders-list {
          display: grid;
          gap: 10px;
        }

        .order-item {
          padding: 12px;
          background: #f5f5f5;
          border-radius: 6px;
          border-left: 4px solid;
          font-size: 12px;
        }

        .order-item.status-executed {
          border-left-color: #4caf50;
        }

        .order-item.status-pending {
          border-left-color: #ff9800;
        }

        .order-item.status-failed {
          border-left-color: #f44336;
        }

        .order-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .order-id {
          font-family: monospace;
          color: #666;
        }

        .status {
          font-weight: bold;
        }

        .status.executed {
          color: #4caf50;
        }

        .status.pending {
          color: #ff9800;
        }

        .status.failed {
          color: #f44336;
        }

        .order-details {
          display: flex;
          justify-content: space-between;
          color: #999;
        }

        .time {
          font-size: 10px;
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: #999;
        }

        .empty {
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 14px;
        }

        @media (max-width: 1400px) {
          .dashboard-layout {
            grid-template-columns: 1fr 1fr;
          }

          .right-column {
            grid-column: 1 / -1;
          }

          .full-height {
            grid-row: auto;
          }
        }

        @media (max-width: 768px) {
          .dashboard-layout {
            grid-template-columns: 1fr;
          }

          .right-column {
            grid-column: auto;
          }

          .header-stats {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
