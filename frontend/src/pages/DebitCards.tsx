import { useEffect, useState, useMemo } from 'react';
import { getTransactions, getCategories, getAccounts } from '../api';
import DebitCardTransactionsGrid from '../components/DebitCardTransactionsGrid';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { TrendingDown, TrendingUp, ArrowDownUp, Hash } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6'];

const fmtDay = (d: string) => {
  const dt = new Date(d);
  return dt.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()];
};

type PieDatum = { name: string; value: number; color: string };

function PieChartWithLegend({ items }: { items: PieDatum[] }) {
  const total = items.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex gap-3" style={{ height: 280 }}>
      <div style={{ width: '52%', minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
              {items.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v: number) => [fmt(v), '']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col justify-center gap-2 flex-1 overflow-y-auto py-1 min-w-0">
        {items.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2 text-xs min-w-0">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="flex-1 truncate text-[var(--text-secondary)]" title={d.name}>{d.name}</span>
              <span className="font-medium flex-shrink-0">{fmt(d.value)}</span>
              <span className="text-[var(--text-secondary)] flex-shrink-0 w-8 text-right">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type GraphId = 'category' | 'merchant' | 'day' | 'tags' | 'account';

const GRAPH_LABELS: Record<GraphId, string> = {
  category: 'Category-wise Spend',
  merchant: 'Top Merchants',
  day:      'Day-wise Spend',
  tags:     'Tag-wise Spend',
  account:  'By Account',
};

const ALL_GRAPH_IDS = Object.keys(GRAPH_LABELS) as GraphId[];

function EmptyState() {
  return <p className="text-[var(--text-secondary)] text-sm py-12 text-center">No data available</p>;
}

function renderGraph(id: GraphId, aux: {
  byCategory: { cat: string; total: number; color?: string }[];
  topMerchants: { desc: string; total: number }[];
  dayData: { date: string; label: string; total: number }[];
  tagsData: { tag: string; total: number }[];
  byAccount: { account: string; total: number }[];
}) {
  const { byCategory, topMerchants, dayData, tagsData, byAccount } = aux;

  switch (id) {
    case 'category':
      return byCategory.length > 0 ? (
        <PieChartWithLegend
          items={byCategory.map((e, i) => ({ name: e.cat, value: e.total, color: e.color || COLORS[i % COLORS.length] }))}
        />
      ) : <EmptyState />;

    case 'merchant':
      return topMerchants.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topMerchants} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis type="category" dataKey="desc" width={130}
              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
              tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {topMerchants.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState />;

    case 'day':
      return dayData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dayData} margin={{ bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
              angle={-45} textAnchor="end" height={55} interval={0} />
            <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={80} />
            <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Date: ${l}`} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState />;

    case 'tags':
      return tagsData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={tagsData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis type="category" dataKey="tag" width={100}
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {tagsData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState />;

    case 'account':
      return byAccount.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byAccount} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis type="category" dataKey="account" width={120}
              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
              tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + '…' : v} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {byAccount.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState />;
  }
}

export default function DebitCards() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [hideIgnored, setHideIgnored] = useState(true);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<[GraphId, GraphId, GraphId]>(['category', 'merchant', 'day']);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => {
    getAccounts({ type: 'savings,current' }).then(setAccounts);
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, any> = { month, year, hide_ignored: hideIgnored, page: 1, per_page: 5000 };
    if (accountId) params.account_id = accountId;
    else params.account_type = 'savings,current';
    getTransactions(params)
      .then(d => setTransactions(d.items || []))
      .finally(() => setLoading(false));
  }, [month, year, hideIgnored, accountId]);

  const catMap = useMemo(() => Object.fromEntries(categories.map((c: any) => [c.id, c])), [categories]);
  const debits = useMemo(() => transactions.filter(t => t.type === 'debit'), [transactions]);
  const credits = useMemo(() => transactions.filter(t => t.type === 'credit'), [transactions]);
  const totalSpend = useMemo(() => debits.reduce((s: number, t: any) => s + t.amount, 0), [debits]);
  const totalCredit = useMemo(() => credits.reduce((s: number, t: any) => s + t.amount, 0), [credits]);
  const net = totalCredit - totalSpend;

  const byCategory = useMemo(() => {
    const map: Record<string, { total: number; color?: string }> = {};
    for (const t of debits) {
      const cat = catMap[t.category_id];
      const name = cat?.name || 'Uncategorized';
      if (!map[name]) map[name] = { total: 0, color: cat?.color };
      map[name].total += t.amount;
    }
    return Object.entries(map)
      .map(([cat, { total, color }]) => ({ cat, total: Math.round(total), color }))
      .sort((a, b) => b.total - a.total);
  }, [debits, catMap]);

  const topMerchants = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of debits) {
      const name = t.custom_description || t.description;
      map[name] = (map[name] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([desc, total]) => ({ desc, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [debits]);

  const dayData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of debits) {
      const day = (t.date || '').slice(0, 10);
      if (day) map[day] = (map[day] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([date, total]) => ({ date, label: fmtDay(date), total: Math.round(total) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [debits]);

  const tagsData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of debits) {
      const tags = (t.tags || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      const list = tags.length > 0 ? tags : ['Untagged'];
      for (const tag of list) map[tag] = (map[tag] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([tag, total]) => ({ tag, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);
  }, [debits]);

  const byAccount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of debits) {
      const acct = t.source_file || 'Unknown';
      map[acct] = (map[acct] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([account, total]) => ({ account, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
  }, [debits]);

  const aux = { byCategory, topMerchants, dayData, tagsData, byAccount };

  const setSlot = (slotIdx: number, id: GraphId) => {
    setSlots(prev => {
      const next = [...prev] as [GraphId, GraphId, GraphId];
      next[slotIdx] = id;
      return next;
    });
  };

  const txnParams: Record<string, any> = { month, year, hide_ignored: hideIgnored };
  if (accountId) txnParams.account_id = accountId;
  else txnParams.account_type = 'savings,current';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Debit Cards</h2>
        <div className="flex gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer select-none border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg-secondary)]">
            <input
              type="checkbox"
              checked={hideIgnored}
              onChange={e => setHideIgnored(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Hide Ignored
          </label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            aria-label="Month"
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            aria-label="Year"
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={accountId ?? ''} onChange={e => setAccountId(e.target.value ? Number(e.target.value) : null)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">
            <option value="">All Accounts</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.nickname || a.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <p className="text-[var(--text-secondary)] text-sm mb-4">Loading…</p>}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={TrendingDown} label="Total Spend"   value={fmt(totalSpend)}   color="text-red-400" />
        <SummaryCard icon={TrendingUp}   label="Total Credit"  value={fmt(totalCredit)}  color="text-green-400" />
        <SummaryCard icon={ArrowDownUp}  label="Net Amount"    value={fmt(Math.abs(net))} color={net >= 0 ? 'text-blue-400' : 'text-orange-400'} />
        <SummaryCard icon={Hash}         label="Transactions"  value={transactions.length.toString()} color="text-yellow-400" />
      </div>

      {/* 3 swappable graph slots */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {slots.map((graphId, slotIdx) => (
          <div key={slotIdx} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">{GRAPH_LABELS[graphId]}</h3>
              <select
                value={graphId}
                onChange={e => setSlot(slotIdx, e.target.value as GraphId)}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-2 py-1 text-xs ml-2"
              >
                {ALL_GRAPH_IDS.map(id => (
                  <option key={id} value={id} disabled={id !== graphId && slots.includes(id)}>
                    {GRAPH_LABELS[id]}
                  </option>
                ))}
              </select>
            </div>
            {!loading && renderGraph(graphId, aux)}
          </div>
        ))}
      </div>

      {/* Transaction grid */}
      <DebitCardTransactionsGrid params={txnParams} />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-[var(--bg-primary)] ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
