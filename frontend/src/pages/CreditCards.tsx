import { useEffect, useState } from 'react';
import { getCreditCardAccounts, getCreditCardCycles, getCreditCardAnalytics } from '../api';
import CreditCardTransactionsGrid from '../components/CreditCardTransactionsGrid';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { CreditCard, TrendingDown, ArrowDownUp, Hash } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6'];

const fmtDay = (d: string) => {
  const dt = new Date(d);
  return dt.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()];
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

// All 6 graph IDs and their labels
type GraphId = 'category' | 'own_other' | 'regular_emi' | 'card' | 'tags' | 'day';

const GRAPH_LABELS: Record<GraphId, string> = {
  category:    'Category-wise Spend',
  own_other:   'Own vs Other Spend',
  regular_emi: 'Regular vs EMI',
  card:        'Card-wise Spend',
  tags:        'Spend by Tags',
  day:         'Day-wise Spend',
};

const ALL_GRAPH_IDS = Object.keys(GRAPH_LABELS) as GraphId[];

function renderGraph(id: GraphId, data: any, aux: {
  ownOtherData: { name: string; value: number }[];
  emiData: { name: string; value: number }[];
  tagsData: { tag: string; total: number }[];
  dayData: { date: string; label: string; total: number }[];
}) {
  const { ownOtherData, emiData, tagsData, dayData } = aux;

  switch (id) {
    case 'category':
      return data.by_category.length > 0 ? (
        <PieChartWithLegend
          items={data.by_category.map((e: any, i: number) => ({
            name: e.category,
            value: e.total,
            color: e.color || COLORS[i % COLORS.length],
          }))}
        />
      ) : <EmptyState />;

    case 'own_other':
      return ownOtherData.length > 0 ? (
        <PieChartWithLegend
          items={ownOtherData.map((d, i) => ({
            name: d.name,
            value: d.value,
            color: ['#6366f1', '#f59e0b'][i],
          }))}
        />
      ) : <EmptyState />;

    case 'regular_emi':
      return emiData.length > 0 ? (
        <PieChartWithLegend
          items={emiData.map((d, i) => ({
            name: d.name,
            value: d.value,
            color: ['#22c55e', '#ef4444'][i],
          }))}
        />
      ) : <EmptyState />;

    case 'card':
      return data.by_card.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.by_card} margin={{ left: 10 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis
              type="category" dataKey="card" width={120}
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              tickFormatter={(v: string) => v.length > 15 ? v.slice(0, 15) + '…' : v}
            />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {data.by_card.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState />;

    case 'tags':
      return tagsData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={tagsData} margin={{ left: 10 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis
              type="category" dataKey="tag" width={100}
              tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
              tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '…' : v}
            />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {tagsData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState />;

    case 'day':
      return dayData.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={dayData} margin={{ bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
              angle={-45} textAnchor="end" height={55} interval={0}
            />
            <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={80} />
            <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l) => `Date: ${l}`} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyState />;
  }
}

export default function CreditCards() {
  const [cycles, setCycles] = useState<{ cycle: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; name: string; bank: string; nickname?: string }[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Which graph is shown in each of the 3 slots
  const [slots, setSlots] = useState<[GraphId, GraphId, GraphId]>(['category', 'card', 'day']);
  const [hideIgnored, setHideIgnored] = useState(true);

  useEffect(() => {
    getCreditCardCycles().then((c: any[]) => {
      setCycles(c);
      if (c.length > 0) setSelectedCycle(c[0].cycle);
    });
    getCreditCardAccounts().then(setAccounts);
  }, []);

  useEffect(() => {
    if (!selectedCycle) return;
    setLoading(true);
    getCreditCardAnalytics({ cycle: selectedCycle, account_id: accountId || undefined, hide_ignored: hideIgnored })
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedCycle, accountId, hideIgnored]);

  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const ownOtherData = data ? [
    { name: 'Own', value: data.own_vs_other.own },
    { name: 'Other', value: data.own_vs_other.other },
  ].filter(d => d.value > 0) : [];

  const emiData = data ? [
    { name: 'Regular', value: data.regular_vs_emi.regular },
    { name: 'EMI', value: data.regular_vs_emi.emi },
  ].filter(d => d.value > 0) : [];

  const tagsData = data ? (() => {
    const tagMap: Record<string, number> = {};
    for (const t of data.all_spends) {
      const raw: string = t.tags || '';
      const tags = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
      const list = tags.length > 0 ? tags : ['Untagged'];
      for (const tag of list) tagMap[tag] = (tagMap[tag] || 0) + t.amount;
    }
    return Object.entries(tagMap)
      .map(([tag, total]) => ({ tag, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
  })() : [];

  const dayData = data ? (() => {
    const dayMap: Record<string, number> = {};
    for (const t of data.all_spends) {
      const day = t.date.slice(0, 10);
      dayMap[day] = (dayMap[day] || 0) + t.amount;
    }
    return Object.entries(dayMap)
      .map(([date, total]) => ({ date, label: fmtDay(date), total: Math.round(total) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  })() : [];

  const aux = { ownOtherData, emiData, tagsData, dayData };

  const setSlot = (slotIdx: number, id: GraphId) => {
    setSlots(prev => {
      const next = [...prev] as [GraphId, GraphId, GraphId];
      next[slotIdx] = id;
      return next;
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Credit Cards</h2>
        <div className="flex gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideIgnored}
              onChange={e => setHideIgnored(e.target.checked)}
              className="w-4 h-4 accent-indigo-500"
            />
            Hide Ignored
          </label>
          <select
            value={selectedCycle}
            onChange={e => setSelectedCycle(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          >
            {cycles.map(c => {
              const [y, m] = c.cycle.split('-').map(Number);
              return <option key={c.cycle} value={c.cycle}>{months[m]} {y} Card Cycle</option>;
            })}
          </select>
          <select
            value={accountId ?? ''}
            onChange={e => setAccountId(e.target.value ? Number(e.target.value) : null)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Cards</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.nickname || a.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <p className="text-[var(--text-secondary)] text-sm mb-4">Loading…</p>}

      {data && (
        <>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Card Cycle: <span className="font-medium text-[var(--text-primary)]">{data.billing_cycle.label}</span>
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard icon={TrendingDown} label="Total Spend"    value={fmt(data.summary.total_spend)}    color="text-red-400" />
            <SummaryCard icon={CreditCard}   label="Total Credits"  value={fmt(data.summary.total_credits)}  color="text-green-400" />
            <SummaryCard icon={ArrowDownUp}  label="Net Amount"     value={fmt(data.summary.net)}            color="text-blue-400" />
            <SummaryCard icon={Hash}         label="Transactions"   value={data.summary.transaction_count.toString()} color="text-yellow-400" />
          </div>

          {/* Single row of 3 swappable graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {slots.map((graphId, slotIdx) => (
              <div key={slotIdx} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                {/* Card header with dropdown */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold">{GRAPH_LABELS[graphId]}</h3>
                  <select
                    value={graphId}
                    onChange={e => setSlot(slotIdx, e.target.value as GraphId)}
                    className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md px-2 py-1 text-xs ml-2"
                  >
                    {ALL_GRAPH_IDS.map(id => (
                      <option
                        key={id}
                        value={id}
                        disabled={id !== graphId && slots.includes(id)}
                      >
                        {GRAPH_LABELS[id]}
                      </option>
                    ))}
                  </select>
                </div>

                {renderGraph(graphId, data, aux)}
              </div>
            ))}
          </div>

          <CreditCardTransactionsGrid cycle={selectedCycle} accountId={accountId} />
        </>
      )}
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

function EmptyState() {
  return <p className="text-[var(--text-secondary)] text-sm py-12 text-center">No data available</p>;
}
