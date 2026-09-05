'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { MetricCard, PageIntro, SectionCard, SkeletonRow, EmptyState } from '@/components/EnterpriseUI';
import { useApi } from '@/hooks/useApi';
import { useRealtimeAlpha, useRealtimeOrders, useRealtimePrice } from '@/hooks/useRealtime';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  FiDollarSign, FiTrendingUp, FiActivity, FiRepeat,
  FiArrowUpRight, FiArrowDownRight, FiZap,
} from 'react-icons/fi';

interface PortfolioSummary {
  total_value?: number; total_trades?: number; total_quantity?: number;
  cash?: number; positions?: Position[];
}
interface Position { symbol: string; quantity: number; averagePrice: number; marketValue: number; }
interface PnL { totalPnl?: number; realizedPnl?: number; unrealizedPnl?: number; returnPercentage?: number; }
interface Order { orderId?: string; symbol: string; side: string; quantity: number; status: string; createdAt?: string; timestamp?: string; executedPrice?: number; }

const DONUT_COLORS = ['#2563eb','#7c3aed','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];

const CustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
};

export default function DashboardPage() {
  const router = useRouter();
  const { get } = useApi();

  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [pnl, setPnl] = useState<PnL | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
    const u = localStorage.getItem('userId') || '';
    if (!t) { router.push('/login'); return; }
    setToken(t); setUserId(u);
  }, [router]);

  const { regime, sentiment } = useRealtimeAlpha(token);
  const { orders: liveOrders } = useRealtimeOrders(token);
  const { prices } = useRealtimePrice(token);

  const loadData = useCallback(async (uid: string, signal: AbortSignal) => {
    if (!uid) return;
    setLoading(true); setFetchError(null);
    try {
      const [portfolioData, pnlData, orderData] = await Promise.all([
        get(`/api/v1/portfolio/${uid}`),
        get(`/api/v1/portfolio/${uid}/pnl`),
        get(`/api/v1/trading/history/${uid}`),
      ]);
      if (signal.aborted) return;
      setPortfolio(portfolioData || null);
      setPnl(pnlData || null);
      setRecentOrders((orderData || []).slice(0, 5));
    } catch (err: unknown) {
      if (!signal.aborted) setFetchError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    loadData(userId, controller.signal);
    return () => controller.abort();
  }, [userId, loadData]);

  const sentimentLabel = sentiment >= 0.6 ? 'Bullish' : sentiment <= 0.4 ? 'Defensive' : 'Balanced';
  const sentimentTone = sentiment >= 0.6 ? 'positive' : sentiment <= 0.4 ? 'warning' : 'default';
  const pnlTone = (pnl?.totalPnl || 0) >= 0 ? 'positive' : 'warning';
  const activityFeed = liveOrders.length ? liveOrders.slice(0, 6) : recentOrders;

  // Positions with live prices
  const positions: Position[] = portfolio?.positions || [];
  const enrichedPositions = positions.map(pos => {
    const livePrice = prices.get(pos.symbol)?.price || prices.get(`${pos.symbol}.NS`)?.price || pos.averagePrice;
    const liveValue = pos.quantity * livePrice;
    const livePnl = (livePrice - pos.averagePrice) * pos.quantity;
    const livePnlPct = pos.averagePrice > 0 ? (livePrice - pos.averagePrice) / pos.averagePrice * 100 : 0;
    return { ...pos, livePrice, liveValue, livePnl, livePnlPct };
  });

  // Donut allocation data
  const allocationData = enrichedPositions
    .filter(p => p.liveValue > 0)
    .map((p, i) => ({ name: p.symbol, value: p.liveValue, color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  if ((portfolio?.cash || 0) > 0) allocationData.push({ name: 'Cash', value: portfolio?.cash || 0, color: '#94a3b8' });

  return (
    <Layout>
      <div className="space-y-6">
        <PageIntro
          badge="Trading Overview"
          title="Enterprise Portfolio Command Center"
          description="Real-time portfolio performance, open positions, market state, and order activity — unified in one workspace."
          actions={
            <button className="secondary-button text-xs" onClick={() => { if (userId) loadData(userId, new AbortController().signal); }}>
              <FiRepeat size={13} /> Refresh
            </button>
          }
        />

        {fetchError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <FiActivity className="text-amber-500 shrink-0" />{fetchError} — data shown may be stale.
          </div>
        )}

        {/* Key metrics */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Portfolio Value" loading={loading}
            value={`₹${(portfolio?.total_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            hint="Current book" icon={<FiDollarSign size={16} />} />
          <MetricCard label="Total P&L" loading={loading}
            value={`${(pnl?.totalPnl || 0) >= 0 ? '+' : ''}₹${(pnl?.totalPnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            hint={(pnl?.totalPnl || 0) >= 0 ? 'Profitable' : 'Watch'} tone={pnlTone}
            icon={(pnl?.totalPnl || 0) >= 0 ? <FiArrowUpRight size={16} /> : <FiArrowDownRight size={16} />} />
          <MetricCard label="Market Regime" loading={loading}
            value={regime || 'Balanced'} hint={sentimentLabel} tone={sentimentTone}
            icon={<FiTrendingUp size={16} />} />
          <MetricCard label="Trade Count" loading={loading}
            value={String(portfolio?.total_trades || 0)}
            hint={`${portfolio?.total_quantity || 0} units`} icon={<FiRepeat size={16} />} />
        </div>

        {/* Open Positions + Allocation */}
        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          {/* Open Positions Table */}
          <SectionCard title="Open Positions" description="Live P&L updated from the real-time price feed."
            actions={<Link href="/trading" className="secondary-button text-xs flex items-center gap-1.5"><FiZap size={12} /> Trade</Link>}>
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <SkeletonRow key={i} />)}</div>
            ) : enrichedPositions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['Symbol', 'Qty', 'Avg Cost', 'Live Price', 'Value', 'P&L', 'P&L %'].map(h => (
                        <th key={h} className="table-header py-2.5 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrichedPositions.map(pos => (
                      <tr key={pos.symbol} className="hover:bg-slate-50/70 transition-colors">
                        <td className="table-cell font-bold text-slate-900">{pos.symbol}</td>
                        <td className="table-cell tabular-nums font-mono text-slate-700">{pos.quantity.toLocaleString('en-IN')}</td>
                        <td className="table-cell tabular-nums font-mono text-slate-500">₹{pos.averagePrice.toFixed(2)}</td>
                        <td className="table-cell tabular-nums font-mono font-semibold text-slate-900">₹{pos.livePrice.toFixed(2)}</td>
                        <td className="table-cell tabular-nums font-mono text-slate-700">₹{pos.liveValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className={`table-cell tabular-nums font-bold ${pos.livePnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {pos.livePnl >= 0 ? '+' : ''}₹{pos.livePnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`table-cell tabular-nums font-bold ${pos.livePnlPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {pos.livePnlPct >= 0 ? '+' : ''}{pos.livePnlPct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No open positions" description="Your portfolio positions will appear here with live P&L as soon as you place trades." />
            )}
          </SectionCard>

          {/* Allocation Donut */}
          <SectionCard title="Portfolio Allocation" description="Current value distribution across holdings.">
            {allocationData.length > 0 ? (
              <div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocationData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                        dataKey="value" labelLine={false} label={CustomPieLabel}>
                        {allocationData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-1.5">
                  {allocationData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="font-semibold text-slate-700">{d.name}</span>
                      </div>
                      <span className="text-slate-500 tabular-nums font-mono">
                        ₹{d.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState title="No holdings" description="Allocation chart will populate once you hold positions." />
            )}
          </SectionCard>
        </div>

        {/* Desk Summary + Live Activity */}
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <SectionCard title="Desk Summary" description="Portfolio performance, market signals, and P&L breakdown.">
            <div className="grid gap-4 sm:grid-cols-3">
              {loading ? [1,2,3].map(i => (
                <div key={i} className="app-card-muted rounded-xl p-4 space-y-2">
                  <div className="skeleton h-2.5 w-24" /><div className="skeleton h-7 w-32" /><div className="skeleton h-2.5 w-40" />
                </div>
              )) : [
                { label: 'Signal Confidence', value: `${Math.round(sentiment * 100)}%`, note: 'Live sentiment stream' },
                { label: 'Return %', value: `${(pnl?.returnPercentage || 0).toFixed(2)}%`, note: 'Realized + unrealized' },
                { label: 'Unrealized P&L', value: `₹${(pnl?.unrealizedPnl || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, note: 'Open positions' },
              ].map(({ label, value, note }) => (
                <div key={label} className="app-card-muted rounded-xl p-4">
                  <p className="data-label">{label}</p>
                  <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
                  <p className="mt-1 text-xs text-slate-500">{note}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Live Activity" description="Latest order stream.">
            <div className="space-y-2">
              {loading ? [1,2,3].map(i => <SkeletonRow key={i} />) : activityFeed.length > 0 ? activityFeed.map((order, idx) => {
                const key = order.orderId || String(idx);
                const isUp = order.side === 'BUY';
                const ts = (order as any).createdAt || order.timestamp;
                return (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-white hover:border-slate-200 transition-all">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{order.symbol}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className={`font-bold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>{order.side}</span> · {order.quantity} units
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700">{order.status}</p>
                      <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                    </div>
                  </div>
                );
              }) : <EmptyState title="No activity yet" description="Order activity will appear here in real time." />}
            </div>
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}