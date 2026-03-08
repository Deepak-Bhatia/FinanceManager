import { useEffect, useState } from 'react';
import { getCreditCardAccounts, getCreditCardCycles, getCreditCardAnalytics } from '../api';
import CreditCardTransactionsGrid from '../components/CreditCardTransactionsGrid';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { CreditCard, TrendingDown, ArrowDownUp, Hash } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const COLORS = ['#6366f1', '#f43f5e', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6'];

export default function CreditCards() {
  const [cycles, setCycles] = useState<{ cycle: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; name: string; bank: string }[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load cycles and accounts on mount
  useEffect(() => {
    getCreditCardCycles().then((c: any[]) => {
      setCycles(c);
      if (c.length > 0) setSelectedCycle(c[0].cycle);
    });
    getCreditCardAccounts().then(setAccounts);
  }, []);

  // Fetch analytics when filters change
  useEffect(() => {
    if (!selectedCycle) return;
    setLoading(true);
    getCreditCardAnalytics({ cycle: selectedCycle, account_id: accountId || undefined })
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedCycle, accountId]);

  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Chart data helpers
  const ownOtherData = data ? [
    { name: 'Own', value: data.own_vs_other.own },
    { name: 'Other', value: data.own_vs_other.other },
  ].filter(d => d.value > 0) : [];

  const emiData = data ? [
    { name: 'Regular', value: data.regular_vs_emi.regular },
    { name: 'EMI', value: data.regular_vs_emi.emi },
  ].filter(d => d.value > 0) : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Credit Cards</h2>
        <div className="flex gap-2 flex-wrap">
          {/* Card cycle selector */}
          <select
            value={selectedCycle}
            onChange={e => setSelectedCycle(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          >
            {cycles.map(c => {
              const [y, m] = c.cycle.split('-').map(Number);
              return (
                <option key={c.cycle} value={c.cycle}>
                  {months[m]} {y} Card Cycle
                </option>
              );
            })}
          </select>

          {/* Account filter */}
          <select
            value={accountId ?? ''}
            onChange={e => setAccountId(e.target.value ? Number(e.target.value) : null)}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Cards</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-[var(--text-secondary)] text-sm mb-4">Loading…</p>}

      {data && (
        <>
          {/* Card cycle label */}
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Card Cycle: <span className="font-medium text-[var(--text-primary)]">{data.billing_cycle.label}</span>
          </p>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard icon={TrendingDown} label="Total Spend" value={fmt(data.summary.total_spend)} color="text-red-400" />
            <SummaryCard icon={CreditCard} label="Total Credits" value={fmt(data.summary.total_credits)} color="text-green-400" />
            <SummaryCard icon={ArrowDownUp} label="Net Amount" value={fmt(data.summary.net)} color="text-blue-400" />
            <SummaryCard icon={Hash} label="Transactions" value={data.summary.transaction_count.toString()} color="text-yellow-400" />
          </div>

          {/* 4 Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Category-wise */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-base font-semibold mb-4">Category-wise Spend</h3>
              {data.by_category.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.by_category}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ category, total }: any) => `${category}: ${fmt(total)}`}
                    >
                      {data.by_category.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>

            {/* Card-wise */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-base font-semibold mb-4">Card-wise Spend</h3>
              {data.by_card.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.by_card} margin={{ left: 10 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="card"
                      width={150}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                      tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 20) + '…' : v}
                    />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {data.by_card.map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>

            {/* Own vs Other */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-base font-semibold mb-4">Own vs Other Spend</h3>
              {ownOtherData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={ownOtherData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }: any) => `${name}: ${fmt(value)}`}
                    >
                      <Cell fill="#6366f1" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>

            {/* Regular vs EMI */}
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="text-base font-semibold mb-4">Regular vs EMI</h3>
              {emiData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={emiData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }: any) => `${name}: ${fmt(value)}`}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyState />}
            </div>
          </div>

          {/* Credit Card Transactions Grid */}
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
