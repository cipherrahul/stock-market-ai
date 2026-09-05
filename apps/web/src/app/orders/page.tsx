'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { EmptyState, PageIntro, SectionCard } from '@/components/EnterpriseUI';
import { useApi } from '@/hooks/useApi';
import { Order } from '@/types';
import {
  FiDownload, FiArrowUpRight, FiArrowDownRight,
  FiCheckCircle, FiAlertTriangle, FiClock, FiSearch,
} from 'react-icons/fi';

type SideFilter = 'all' | 'buy' | 'sell';
type VariantFilter = 'all' | 'CNC' | 'MIS';

function exportToCSV(orders: Order[]) {
  const header = ['Date', 'Symbol', 'Side', 'Variant', 'Qty', 'Price', 'Value (₹)', 'Slippage %', 'Status'];
  const rows = orders.map(o => [
    new Date(o.createdAt).toLocaleString('en-IN'),
    o.symbol,
    o.side,
    (o as any).order_variant || 'CNC',
    o.quantity,
    o.price.toFixed(2),
    (o.quantity * o.price).toFixed(2),
    (o as any).slippage ? ((o as any).slippage / Math.max(o.price, 0.01) * 100).toFixed(4) : '0.0000',
    o.status,
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sovereign_orders_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Order history exported to CSV');
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'EXECUTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
      status === 'FAILED' ? 'bg-rose-50    text-rose-700    border border-rose-200' :
        status === 'PENDING' ? 'bg-amber-50   text-amber-700   border border-amber-200' :
          'bg-slate-100 text-slate-600 border border-slate-200';
  const Icon = status === 'EXECUTED' ? FiCheckCircle : status === 'FAILED' ? FiAlertTriangle : FiClock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <Icon size={10} />{status}
    </span>
  );
}

function VariantBadge({ variant }: { variant: string }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold tracking-widest border ${variant === 'MIS'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : 'bg-sky-50 text-sky-700 border-sky-200'
      }`}>{variant || 'CNC'}</span>
  );
}

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const router = useRouter();
  const { get, loading } = useApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [sideFilter, setSideFilter] = useState<SideFilter>('all');
  const [variantFilter, setVariantFilter] = useState<VariantFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  useEffect(() => { if (!token) router.push('/login'); }, [router, token]);

  useEffect(() => {
    if (!userId) return;
    get(`/api/v1/trading/history/${userId}`)
      .then(data => setOrders(data || []))
      .catch(() => toast.error('Unable to load order history'));
  }, [get, userId]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (sideFilter !== 'all') result = result.filter(o => o.side === sideFilter.toUpperCase());
    if (variantFilter !== 'all') result = result.filter(o => ((o as any).order_variant || 'CNC') === variantFilter);
    if (searchQuery.trim()) result = result.filter(o => o.symbol.toUpperCase().includes(searchQuery.toUpperCase().trim()));
    return result;
  }, [orders, sideFilter, variantFilter, searchQuery]);

  const paginatedOrders = filteredOrders.slice(0, page * PAGE_SIZE);
  const hasMore = filteredOrders.length > page * PAGE_SIZE;

  // Summary stats
  const stats = useMemo(() => {
    const executed = orders.filter(o => (o.status as string)?.toUpperCase() === 'EXECUTED');
    const totalValue = executed.reduce((s, o) => s + o.quantity * o.price, 0);
    const totalQty = executed.reduce((s, o) => s + o.quantity, 0);
    const buys = executed.filter(o => o.side === 'BUY').length;
    const sells = executed.filter(o => o.side === 'SELL').length;
    return { total: orders.length, executed: executed.length, totalValue, totalQty, buys, sells };
  }, [orders]);

  return (
    <Layout>
      <div className="space-y-6">
        <PageIntro
          badge="Orders"
          title="Transaction Ledger"
          description="Complete order history with per-trade slippage, product type (CNC/MIS), and CSV export for tax filing."
          actions={
            <button
              onClick={() => exportToCSV(filteredOrders)}
              className="primary-button text-xs flex items-center gap-1.5"
              disabled={filteredOrders.length === 0}
            >
              <FiDownload size={13} /> Export CSV
            </button>
          }
        />

        {/* Summary metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Orders', value: stats.total.toString() },
            { label: 'Executed', value: stats.executed.toString() },
            { label: 'Total Turnover', value: `₹${stats.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
            { label: 'Shares Traded', value: stats.totalQty.toLocaleString('en-IN') },
          ].map(({ label, value }) => (
            <div key={label} className="app-card-muted rounded-xl p-4">
              <p className="data-label">{label}</p>
              <p className="mt-2 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        <SectionCard
          title="Order Ledger"
          description={`${filteredOrders.length} record${filteredOrders.length !== 1 ? 's' : ''} matching current filters`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search symbol…"
                  className="h-8 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>
              {/* Side filter */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(['all', 'buy', 'sell'] as SideFilter[]).map(f => (
                  <button key={f} onClick={() => setSideFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${sideFilter === f ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Variant filter */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(['all', 'CNC', 'MIS'] as VariantFilter[]).map(f => (
                  <button key={f} onClick={() => setVariantFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold transition-colors ${variantFilter === f
                      ? f === 'MIS' ? 'bg-purple-600 text-white' : f === 'CNC' ? 'bg-sky-600 text-white' : 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {loading && orders.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
            </div>
          ) : paginatedOrders.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Date & Time', 'Symbol', 'Side', 'Type', 'Qty', 'Price (₹)', 'Value (₹)', 'Slippage', 'Status'].map(h => (
                      <th key={h} className="table-header py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((order, i) => {
                    const variant = (order as any).order_variant || 'CNC';
                    const slippageRaw = (order as any).slippage || 0;
                    const slippagePct = order.price > 0 ? (slippageRaw / order.price * 100) : 0;
                    return (
                      <tr key={order.id || i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="table-cell text-xs text-slate-500 whitespace-nowrap font-mono">
                          {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="table-cell font-bold text-slate-900">{order.symbol}</td>
                        <td className="table-cell">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${order.side === 'BUY' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {order.side === 'BUY' ? <FiArrowUpRight size={10} /> : <FiArrowDownRight size={10} />}
                            {order.side}
                          </span>
                        </td>
                        <td className="table-cell"><VariantBadge variant={variant} /></td>
                        <td className="table-cell tabular-nums font-mono">{order.quantity.toLocaleString('en-IN')}</td>
                        <td className="table-cell tabular-nums font-mono">₹{order.price.toFixed(2)}</td>
                        <td className="table-cell tabular-nums font-semibold text-slate-900">
                          ₹{(order.quantity * order.price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className={`table-cell tabular-nums text-xs font-mono ${slippagePct > 0.1 ? 'text-amber-600' : 'text-slate-500'}`}>
                          {slippagePct.toFixed(4)}%
                        </td>
                        <td className="table-cell"><StatusBadge status={order.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button onClick={() => setPage(p => p + 1)} className="secondary-button text-xs">
                    Load more ({filteredOrders.length - paginatedOrders.length} remaining)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState title="No orders match your filters" description="Try clearing the search or changing the side/type filter." />
          )}
        </SectionCard>
      </div>
    </Layout>
  );
}
