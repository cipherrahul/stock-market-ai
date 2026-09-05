'use client';

import React from 'react';
import { FiBriefcase, FiTarget, FiActivity, FiArrowUpRight, FiArrowDownRight, FiPackage } from 'react-icons/fi';
import { useRealtimePortfolio, useRealtimeOrders } from '@/hooks/useRealtime';
import { StatusBadge, EmptyState } from './EnterpriseUI';
import { MotionDiv, AnimatePresence } from './Motion';

interface PortfolioDashboardProps {
  token: string;
  userId: string;
  isPaper?: boolean;
}

const US_SYMBOLS = new Set(['AAPL','MSFT','GOOGL','AMZN','NVDA','TSLA','META','GOOG','NFLX','AMD']);
const currencySymbol = (sym: string) => US_SYMBOLS.has(sym) ? '$' : '₹';

export function PortfolioDashboard({ token, userId, isPaper = false }: PortfolioDashboardProps) {
  const { portfolio, connected: portfolioConnected, error: portfolioError } = useRealtimePortfolio(token, userId, isPaper);
  const { orders, connected: ordersConnected } = useRealtimeOrders(token, isPaper);

  return (
    <div className="space-y-5">
      {/* Portfolio Summary */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2">
              <FiBriefcase className="text-blue-600" size={15} />
            </div>
            <h3 className="section-title">Sovereign Equity</h3>
          </div>
          <StatusBadge status={portfolioConnected ? 'connected' : 'disconnected'} label={portfolioConnected ? 'Live' : 'Offline'} />
        </div>

        <div className="p-5">
          {portfolioError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 flex items-center gap-2">
              ⚠️ {portfolioError}
            </div>
          )}

          {portfolio ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {/* Total Value */}
                <div className="app-card-muted rounded-xl p-4">
                  <p className="data-label">Total Value</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                    {portfolio.balances
                      ? portfolio.balances.map((b) => (
                          <span key={b.currency} className="block">
                            {b.currency === 'INR' ? '₹' : '$'}{(Number(b.cash) / 100).toLocaleString()}
                          </span>
                        ))
                      : `₹${portfolio.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                  </p>
                </div>

                {/* Absolute Gain */}
                <div className="app-card-muted rounded-xl p-4">
                  <p className="data-label">Absolute Gain</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {portfolio.totalGain >= 0
                      ? <FiArrowUpRight className="text-emerald-600 shrink-0" size={18} />
                      : <FiArrowDownRight className="text-red-600 shrink-0" size={18} />}
                    <p className={`text-2xl font-bold tabular-nums ${portfolio.totalGain >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {portfolio.totalGain >= 0 ? '+' : ''}₹{Math.abs(portfolio.totalGain).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>

                {/* Return % */}
                <div className="app-card-muted rounded-xl p-4">
                  <p className="data-label">Return %</p>
                  <p className={`mt-2 text-2xl font-bold tabular-nums ${portfolio.gainPercent >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {portfolio.gainPercent >= 0 ? '+' : ''}{portfolio.gainPercent.toFixed(2)}%
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400 tabular-nums">
                Last sync: {new Date(portfolio.timestamp).toLocaleTimeString()} · Ref: SOV-{userId.slice(0, 6).toUpperCase()}
              </p>
            </>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orders Stream + Positions in a grid */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        {/* Orders Stream */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                <FiActivity className="text-slate-600" size={15} />
              </div>
              <h3 className="section-title">Order Stream</h3>
            </div>
            <StatusBadge status={ordersConnected ? 'connected' : 'disconnected'} label={ordersConnected ? 'Live' : 'Offline'} />
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            <AnimatePresence mode="popLayout">
              {orders && orders.length > 0 ? (
                orders.slice(0, 12).map((order) => (
                  <MotionDiv
                    key={order.orderId}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 hover:bg-white hover:border-slate-200 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${order.status === 'EXECUTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {order.status}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{order.symbol || 'SYSTEM'}</span>
                      </div>
                      {order.memo && <p className="mt-1 text-xs text-blue-500/70 italic">{order.memo}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-700 tabular-nums">
                        {order.executedPrice ? `${currencySymbol(order.symbol || '')}${order.executedPrice.toLocaleString()}` : 'PENDING'}
                      </p>
                      <p className="text-xs text-slate-400 tabular-nums">
                        {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </MotionDiv>
                ))
              ) : (
                <div className="py-8">
                  <EmptyState title="No orders yet" description="Executed orders will appear here in real time." />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Positions */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                <FiTarget className="text-emerald-600" size={15} />
              </div>
              <h3 className="section-title">Active Positions</h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">{portfolio?.positions?.length || 0} positions</span>
          </div>
          <div className="p-4">
            {portfolio?.positions && portfolio.positions.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {portfolio.positions.map((position) => {
                  const pnl = position.pnl ?? (position.currentPrice - position.avgCost) * position.quantity;
                  const pnlPct = position.pnlPercent ?? ((position.currentPrice - position.avgCost) / position.avgCost * 100);
                  const isPositive = pnl >= 0;
                  return (
                    <div key={position.symbol} className="rounded-xl border border-slate-100 p-3 hover:border-slate-200 hover:bg-white transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center">
                            <FiPackage size={11} className="text-slate-500" />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{position.symbol}</span>
                        </div>
                        <span className="text-xs text-slate-400 tabular-nums">×{position.quantity}</span>
                      </div>
                      <p className="text-base font-bold text-slate-800 tabular-nums">
                        {currencySymbol(position.symbol)}{position.currentPrice.toLocaleString()}
                      </p>
                      <p className={`text-xs font-semibold tabular-nums mt-0.5 ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{pnlPct.toFixed(2)}% · {currencySymbol(position.symbol)}{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6">
                <EmptyState title="No open positions" description="Active positions will appear here once you execute trades." />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}