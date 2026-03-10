import { useEffect, useState } from 'react';
import { getSummary, getByCategory, getMonthlyTrend, getTopMerchants, getByAccount, getByTag, getRecurringVsImpulsive } from '../api';
import DashboardTransactionsGrid from '../components/DashboardTransactionsGrid';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  AreaChart, Area,
} from 'recharts';
import { IndianRupee, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const TAG_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
  '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#06b6d4',
];
const RIC_COLORS = ['#6366f1', '#f97316'];

function ChartTypeSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label="Chart type"
      className="text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 cursor-pointer text-[var(--text-secondary)]"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [triedPrevious, setTriedPrevious] = useState(false);
  const [hideIgnored, setHideIgnored] = useState(true);
  const initialRef = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

  const [summary, setSummary] = useState<any>(null);
  const [byCategory, setByCategory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [topMerchants, setTopMerchants] = useState<any[]>([]);
  const [byAccount, setByAccount] = useState<any[]>([]);
  const [byTag, setByTag] = useState<any[]>([]);
  const [recurringVsImpulsive, setRecurringVsImpulsive] = useState<any[]>([]);

  // Chart type selectors
  const [catType, setCatType] = useState('pie');
  const [topType, setTopType] = useState('hbar');
  const [trendType, setTrendType] = useState('line');
  const [accountType, setAccountType] = useState('bar');
  const [tagType, setTagType] = useState('bar');
  const [savingsType, setSavingsType] = useState('bar');
  const [recurringType, setRecurringType] = useState('pie');

  const params = { month, year, hide_ignored: hideIgnored };

  useEffect(() => {
    getSummary(params).then((s: any) => {
      setSummary(s);
      const isInitialMonth = month === initialRef.month && year === initialRef.year;
      const noData = !s || (typeof s.transaction_count === 'number' && s.transaction_count === 0);
      if (isInitialMonth && noData && !triedPrevious) {
        let pm = month - 1, py = year;
        if (pm <= 0) { pm = 12; py = year - 1; }
        setTriedPrevious(true);
        setMonth(pm);
        setYear(py);
        return;
      }
    });
    getByCategory(params).then(setByCategory);
    getTopMerchants(params).then(setTopMerchants);
    getByAccount(params).then(setByAccount);
    getByTag(params).then(setByTag);
    getRecurringVsImpulsive(params).then(setRecurringVsImpulsive);
  }, [month, year, hideIgnored]);

  useEffect(() => {
    getMonthlyTrend({ year, hide_ignored: hideIgnored }).then(setTrend);
  }, [year, hideIgnored]);

  const monthlySavings = trend.map(t => ({
    month: t.month,
    savings: Math.round((t.income - t.expense) * 100) / 100,
  }));

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard icon={TrendingDown} label="Total Expense" value={fmt(summary.total_expense)} color="text-red-400" />
          <SummaryCard icon={TrendingUp} label="Total Income" value={fmt(summary.total_income)} color="text-green-400" />
          <SummaryCard icon={Wallet} label="Net Savings" value={fmt(summary.net_savings)} color="text-blue-400" />
          <SummaryCard icon={IndianRupee} label="Transactions" value={summary.transaction_count.toString()} color="text-yellow-400" />
        </div>
      )}

      {/* Full-width: Monthly Trend */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Monthly Trend ({year})</h3>
          <ChartTypeSelect value={trendType} onChange={setTrendType} options={[
            { value: 'line', label: 'Line' },
            { value: 'bar', label: 'Bar' },
            { value: 'area', label: 'Area' },
          ]} />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          {trendType === 'bar' ? (
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : trendType === 'area' ? (
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="#ef444430" strokeWidth={2} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#22c55e" fill="#22c55e30" strokeWidth={2} />
            </AreaChart>
          ) : (
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Row 1: Spend by Category | Top Spends | By Account */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Spend by Category */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Spend by Category</h3>
            <ChartTypeSelect value={catType} onChange={setCatType} options={[
              { value: 'pie', label: 'Pie' },
              { value: 'donut', label: 'Donut' },
              { value: 'bar', label: 'Bar' },
            ]} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {catType === 'bar' ? (
              <BarChart data={[...byCategory].sort((a, b) => b.total - a.total)} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis type="category" dataKey="category" width={110} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {[...byCategory].sort((a, b) => b.total - a.total).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="45%"
                  innerRadius={catType === 'donut' ? 55 : 0}
                  outerRadius={90}
                >
                  {byCategory.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => {
                    const cat = byCategory.find(c => c.category === value);
                    if (!cat) return value;
                    const total = byCategory.reduce((s, c) => s + c.total, 0) || 1;
                    return `${cat.category}: ${fmt(cat.total)} (${((cat.total / total) * 100).toFixed(1)}%)`;
                  }}
                  payload={[...byCategory].sort((a, b) => b.total - a.total).map(cat => ({
                    value: cat.category, type: 'circle' as const, color: cat.color,
                  }))}
                  wrapperStyle={{ fontSize: '10px', maxHeight: 70, overflowY: 'auto' }}
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Top Spends */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Top Spends</h3>
            <ChartTypeSelect value={topType} onChange={setTopType} options={[
              { value: 'hbar', label: 'H. Bar' },
              { value: 'bar', label: 'Bar' },
            ]} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {topType === 'bar' ? (
              <BarChart data={topMerchants}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="description" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }}
                  angle={-30} textAnchor="end" height={70}
                  tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <BarChart data={topMerchants} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                <YAxis type="category" dataKey="description" width={150} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  tickFormatter={v => v.length > 20 ? v.slice(0, 20) + '…' : v} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* By Account */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">By Account</h3>
            <ChartTypeSelect value={accountType} onChange={setAccountType} options={[
              { value: 'bar', label: 'Grouped Bar' },
              { value: 'bar_stacked', label: 'Stacked Bar' },
              { value: 'line', label: 'Line' },
            ]} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {accountType === 'line' ? (
              <LineChart data={byAccount}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="account" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} angle={-20} textAnchor="end" height={60}
                  tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="debit" name="Spent" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="credit" name="Paid" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            ) : (
              <BarChart data={byAccount}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="account" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} angle={-20} textAnchor="end" height={60}
                  tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="debit" name="Spent" fill="#ef4444" radius={[4, 4, 0, 0]}
                  {...(accountType === 'bar_stacked' ? { stackId: 'a' } : {})} />
                <Bar dataKey="credit" name="Paid" fill="#22c55e" radius={[4, 4, 0, 0]}
                  {...(accountType === 'bar_stacked' ? { stackId: 'a' } : {})} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Tag-wise Spend | Month-wise Savings | Recurring vs Impulsive */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Tag-wise Spend */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Tag-wise Spend</h3>
            <ChartTypeSelect value={tagType} onChange={setTagType} options={[
              { value: 'bar', label: 'Bar' },
              { value: 'pie', label: 'Pie' },
              { value: 'donut', label: 'Donut' },
            ]} />
          </div>
          {byTag.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-sm text-[var(--text-secondary)]">No tagged transactions</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              {tagType === 'bar' ? (
                <BarChart data={byTag.slice(0, 12)} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                  <YAxis type="category" dataKey="tag" width={110} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {byTag.slice(0, 12).map((_, i) => <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={byTag.slice(0, 10)}
                    dataKey="total"
                    nameKey="tag"
                    cx="50%"
                    cy="45%"
                    innerRadius={tagType === 'donut' ? 55 : 0}
                    outerRadius={90}
                  >
                    {byTag.slice(0, 10).map((_, i) => <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', maxHeight: 70, overflowY: 'auto' }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* Month-wise Savings */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Month-wise Savings ({year})</h3>
            <ChartTypeSelect value={savingsType} onChange={setSavingsType} options={[
              { value: 'bar', label: 'Bar' },
              { value: 'line', label: 'Line' },
              { value: 'area', label: 'Area' },
            ]} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {savingsType === 'line' ? (
              <LineChart data={monthlySavings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="savings" name="Savings" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            ) : savingsType === 'area' ? (
              <AreaChart data={monthlySavings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="savings" name="Savings" stroke="#3b82f6" fill="#3b82f630" strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={monthlySavings}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="savings" name="Savings" radius={[4, 4, 0, 0]}>
                  {monthlySavings.map((m, i) => (
                    <Cell key={i} fill={m.savings >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Recurring vs Impulsive */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Recurring vs Impulsive</h3>
            <ChartTypeSelect value={recurringType} onChange={setRecurringType} options={[
              { value: 'pie', label: 'Pie' },
              { value: 'donut', label: 'Donut' },
              { value: 'bar', label: 'Bar' },
            ]} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {recurringType === 'bar' ? (
              <BarChart data={recurringVsImpulsive}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="type" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {recurringVsImpulsive.map((_, i) => <Cell key={i} fill={RIC_COLORS[i % RIC_COLORS.length]} />)}
                </Bar>
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={recurringVsImpulsive}
                  dataKey="amount"
                  nameKey="type"
                  cx="50%"
                  cy="45%"
                  innerRadius={recurringType === 'donut' ? 65 : 0}
                  outerRadius={100}
                  label={({ type, percent }) => `${type} ${(percent * 100).toFixed(1)}%`}
                  labelLine={false}
                >
                  {recurringVsImpulsive.map((_, i) => <Cell key={i} fill={RIC_COLORS[i % RIC_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction Grid */}
      <DashboardTransactionsGrid month={month} year={year} hideIgnored={hideIgnored} />
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
