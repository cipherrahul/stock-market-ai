'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts';
import { Layout } from '@/components/Layout';
import { EmptyState, MetricCard, PageIntro, SectionCard } from '@/components/EnterpriseUI';
import { useApi } from '@/hooks/useApi';
import { FiTrendingUp, FiAward, FiBarChart2, FiTarget } from 'react-icons/fi';

interface AnalyticsData { date: string; portfolio_value: number; pnl: number; trades: number; }
interface PnL { totalPnl?: number; realizedPnl?: number; unrealizedPnl?: number; returnPercentage?: number; }
interface Order { symbol: string; side: string; quantity: number; price: number; status: string; createdAt: string; }

function calcMetrics(orders: Order[]) {
  const executed = orders.filter(o => o.status === 'EXECUTED');
  const buys = executed.filter(o => o.side === 'BUY');
  const sells = executed.filter(o => o.side === 'SELL');

  // Match buys to sells per symbol for win-rate
  const symbolMap: Record<string, { avgCost: number; qty: number }> = {};
  let wins = 0, losses = 0;
  buys.forEach(o => {
    if (!symbolMap[o.symbol]) symbolMap[o.symbol] = { avgCost: 0, qty: 0 };
    const s = symbolMap[o.symbol];
    s.avgCost = (s.avgCost * s.qty + o.price * o.quantity) / (s.qty + o.quantity);
    s.qty += o.quantity;
  });
  sells.forEach(o => {
    const s = symbolMap[o.symbol];
    if (s && s.avgCost > 0) {
      if (o.price > s.avgCost) wins++; else losses++;
    }
  });

  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  // Avg win/loss for profit factor
  const avgWin = wins > 0 ? sells.filter(o => symbolMap[o.symbol] && o.price > symbolMap[o.symbol].avgCost).reduce((s, o) => s + o.price * o.quantity, 0) / Math.max(wins, 1) : 0;
  const avgLoss = losses > 0 ? sells.filter(o => symbolMap[o.symbol] && o.price <= symbolMap[o.symbol].avgCost).reduce((s, o) => s + o.price * o.quantity, 0) / Math.max(losses, 1) : 0;
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss : wins > 0 ? Infinity : 0;

  // P&L by symbol
  const pnlBySymbol: Record<string, number> = {};
  sells.forEach(o => {
    const s = symbolMap[o.symbol];
    if (!s) return;
    const profit = (o.price - s.avgCost) * o.quantity;
    pnlBySymbol[o.symbol] = (pnlBySymbol[o.symbol] || 0) + profit;
  });

  return { winRate, profitFactor, wins, losses, totalTrades, pnlBySymbol };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-xl text-xs space-y-1">
      <p className="font-bold text-slate-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums">
          {p.name}: ₹{Number(p.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const router = useRouter();
  const { get } = useApi();
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [stats, setStats] = useState<PnL | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const token  = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  useEffect(() => { if (!token) router.push('/login'); }, [router, token]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      get(`/api/v1/portfolio/${userId}/history`),
      get(`/api/v1/portfolio/${userId}/pnl`),
      get(`/api/v1/trading/history/${userId}`),
    ]).then(([history, pnl, orderData]) => {
      setAnalytics(history || []);
      setStats(pnl || null);
      setOrders(orderData || []);
    }).finally(() => setLoading(false));
  }, [get, userId]);

  const { winRate, profitFactor, wins, losses, totalTrades, pnlBySymbol } = useMemo(() => calcMetrics(orders), [orders]);

  const pnlBySymbolData = Object.entries(pnlBySymbol)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 10)
    .map(([symbol, pnl]) => ({ symbol, pnl }));

  // Sharpe ratio approximation from portfolio history
  const sharpeRatio = useMemo(() => {
    if (analytics.length < 5) return 0;
    const returns = analytics.slice(1).map((d, i) => {
      const prev = analytics[i].portfolio_value;
      return prev > 0 ? (d.portfolio_value - prev) / prev : 0;
    });
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const std = Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length);
    return std > 0 ? Number(((mean / std) * Math.sqrt(252)).toFixed(2)) : 0;
  }, [analytics]);

  // Max drawdown
  const maxDrawdown = useMemo(() => {
    if (analytics.length < 2) return 0;
    let peak = analytics[0].portfolio_value;
    let maxDD = 0;
    analytics.forEach(d => {
      if (d.portfolio_value > peak) peak = d.portfolio_value;
      const dd = (peak - d.portfolio_value) / Math.max(peak, 1);
      if (dd > maxDD) maxDD = dd;
    });
    return Number((maxDD * 100).toFixed(2));
  }, [analytics]);

  const pnlTone = (stats?.totalPnl || 0) >= 0 ? 'positive' : 'danger';

  return (
    <Layout>
      <div className="space-y-6">
        <PageIntro
          badge="Analytics"
          title="Performance Intelligence"
          description="Deep statistical analysis of your trading performance — win rate, Sharpe ratio, drawdown, and P&L by instrument."
        />

        {/* Key Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total P&L"
            loading={loading}
            value={`${(stats?.totalPnl || 0) >= 0 ? '+' : ''}₹${(stats?.totalPnl || 0).toLocaleString('en-IN')}`}
            hint={(stats?.totalPnl || 0) >= 0 ? 'Profitable' : 'Loss'}
            tone={pnlTone}
            icon={<FiTrendingUp size={16} />}
          />
          <MetricCard
            label="Return %"
            loading={loading}
            value={`${(stats?.returnPercentage || 0).toFixed(2)}%`}
            hint="Net performance"
            tone={(stats?.returnPercentage || 0) >= 0 ? 'positive' : 'danger'}
            icon={<FiBarChart2 size={16} />}
          />
          <MetricCard
            label="Realized P&L"
            loading={loading}
            value={`₹${(stats?.realizedPnl || 0).toLocaleString('en-IN')}`}
            hint="Closed positions"
            icon={<FiAward size={16} />}
          />
          <MetricCard
            label="Unrealized P&L"
            loading={loading}
            value={`₹${(stats?.unrealizedPnl || 0).toLocaleString('en-IN')}`}
            hint="Open positions"
            icon={<FiTarget size={16} />}
          />
        </div>

        {/* Trading Statistics Row */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Win Rate',      value: loading ? '—' : `${winRate.toFixed(1)}%`,   sub: `${wins}W / ${losses}L of ${totalTrades} trades`, color: winRate >= 50 ? 'text-emerald-600' : 'text-rose-600' },
            { label: 'Profit Factor', value: loading ? '—' : profitFactor === Infinity ? '∞' : profitFactor.toFixed(2), sub: 'Avg Win / Avg Loss', color: profitFactor >= 1 ? 'text-emerald-600' : 'text-rose-600' },
            { label: 'Sharpe Ratio',  value: loading ? '—' : sharpeRatio.toFixed(2),     sub: 'Annualised', color: sharpeRatio >= 1 ? 'text-emerald-600' : sharpeRatio >= 0 ? 'text-amber-600' : 'text-rose-600' },
            { label: 'Max Drawdown',  value: loading ? '—' : `${maxDrawdown}%`,           sub: 'Peak-to-trough', color: maxDrawdown > 20 ? 'text-rose-600' : maxDrawdown > 10 ? 'text-amber-600' : 'text-emerald-600' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="app-card-muted rounded-xl p-5 space-y-1">
              <p className="data-label">{label}</p>
              <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
              <p className="text-xs text-slate-400">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          {/* Equity Curve */}
          <SectionCard title="Portfolio Equity Curve" description="Historical portfolio value and session P&L trend.">
            {analytics.length ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics} margin={{ left: 10, right: 10 }}>
                    <defs>
                      <linearGradient id="valueFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="pnlFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="portfolio_value" name="Portfolio" stroke="#2563eb" fill="url(#valueFill)" strokeWidth={2.5} dot={false} />
                    <Area type="monotone" dataKey="pnl" name="P&L" stroke="#10b981" fill="url(#pnlFill)" strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No portfolio history" description="Portfolio snapshots will appear here as you trade." />
            )}
          </SectionCard>

          {/* P&L by Symbol */}
          <SectionCard title="P&L by Instrument" description="Realized profit & loss breakdown per symbol.">
            {pnlBySymbolData.length ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlBySymbolData} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="symbol" tick={{ fill: '#475569', fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} width={72} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pnl" name="P&L" radius={[0, 4, 4, 0]}>
                      {pnlBySymbolData.map((entry, i) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : loading ? (
              <div className="h-[300px] flex items-center justify-center"><p className="text-xs text-slate-400">Loading analytics…</p></div>
            ) : (
              <EmptyState title="No closed trades yet" description="P&L will appear once you have executed and closed positions." />
            )}
          </SectionCard>
        </div>

        {/* Trade Frequency by Day */}
        {analytics.length > 0 && (
          <SectionCard title="Daily Trade Volume" description="Number of trades executed each day.">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="trades" name="Trades" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        )}
      </div>
    </Layout>
  );
}
