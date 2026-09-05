import React from 'react';

export function PageIntro({
  badge,
  title,
  description,
  actions,
}: {
  badge: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="eyebrow">{badge}</p>
        <h1 className="page-title mt-2">{title}</h1>
        <p className="page-subtitle mt-3">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  id,
  title,
  description,
  actions,
  children,
  className = '',
}: {
  id?: string;
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`section-card ${className}`}>
      <div className="section-card-header">
        <div>
          <h2 className="section-title">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
  loading = false,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  const toneStyles: Record<string, { pill: string; value: string }> = {
    default:  { pill: 'status-pill-neutral', value: 'text-slate-900' },
    positive: { pill: 'status-pill-success', value: 'text-emerald-700' },
    warning:  { pill: 'status-pill-warning', value: 'text-amber-700' },
    danger:   { pill: 'status-pill-danger',  value: 'text-red-700' },
  };
  const t = toneStyles[tone];

  if (loading) {
    return (
      <div className="metric-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-8 w-32" />
          </div>
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon ? <div className="rounded-lg bg-slate-50 p-2 text-slate-500 border border-slate-100">{icon}</div> : null}
          <div>
            <p className="data-label">{label}</p>
            <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${t.value}`}>{value}</p>
          </div>
        </div>
        <span className={`status-pill ${t.pill} shrink-0`}>{hint}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

// ── Skeleton Components ───────────────────────────────────────────────────────

export function SkeletonMetric() {
  return (
    <div className="metric-card space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-2.5 w-16" />
          <div className="skeleton h-7 w-28" />
        </div>
        <div className="skeleton h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="app-card p-6 space-y-3">
      <div className="skeleton h-4 w-32 mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton h-3 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
      <div className="space-y-2 flex-1">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-2.5 w-36" />
      </div>
      <div className="space-y-2 text-right">
        <div className="skeleton h-3 w-16 ml-auto" />
        <div className="skeleton h-2.5 w-20 ml-auto" />
      </div>
    </div>
  );
}

// ── StatusBadge ──────────────────────────────────────────────────────────────

export function StatusBadge({
  status,
  label,
}: {
  status: 'connected' | 'disconnected' | 'error' | 'warning' | 'neutral';
  label: string;
}) {
  const styles: Record<string, { pill: string; dot: string }> = {
    connected:    { pill: 'status-pill-success', dot: 'live-dot' },
    disconnected: { pill: 'status-pill-neutral', dot: 'w-2 h-2 rounded-full bg-slate-400' },
    error:        { pill: 'status-pill-danger',  dot: 'live-dot-danger' },
    warning:      { pill: 'status-pill-warning', dot: 'w-2 h-2 rounded-full bg-amber-500' },
    neutral:      { pill: 'status-pill-neutral', dot: 'w-2 h-2 rounded-full bg-slate-400' },
  };
  const s = styles[status] || styles.neutral;

  return (
    <span className={`status-pill ${s.pill}`}>
      <span className={s.dot} />
      {label}
    </span>
  );
}

// ── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  badge,
  actions,
}: {
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="section-card-header">
      <div className="flex items-center gap-3">
        <h3 className="section-title">{title}</h3>
        {badge}
      </div>
      {actions}
    </div>
  );
}
