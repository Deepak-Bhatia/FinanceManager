import { useEffect, useState } from 'react';
import { getSummary, getByCategory, getMonthlyTrend, getTopMerchants, getByAccount } from '../api';
import DashboardTransactionsGrid from '../components/DashboardTransactionsGrid';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { IndianRupee, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function Dashboard() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [triedPrevious, setTriedPrevious] = useState(false);
  const initialRef = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
  const [summary, setSummary] = useState<any>(null);
  const [byCategory, setByCategory] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [topMerchants, setTopMerchants] = useState<any[]>([]);
  const [byAccount, setByAccount] = useState<any[]>([]);

  const params = { month, year };

  useEffect(() => {
    getSummary(params).then((s: any) => {
      setSummary(s);
      // If current month (initial load) has no transactions, fallback once to previous month
      const isInitialMonth = month === initialRef.month && year === initialRef.year;
      const noData = !s || (typeof s.transaction_count === 'number' && s.transaction_count === 0);
      if (isInitialMonth && noData && !triedPrevious) {
        // compute previous month/year
        let pm = month - 1;
        let py = year;
        if (pm <= 0) { pm = 12; py = year - 1; }
        setTriedPrevious(true);
        setMonth(pm);
        setYear(py);
        return; // wait for effect to re-run with previous month
      }
    });
    getByCategory(params).then(setByCategory);
    getTopMerchants(params).then(setTopMerchants);
    getByAccount(params).then(setByAccount);
  }, [month, year]);

  useEffect(() => {
    getMonthlyTrend({ year }).then(setTrend);
  }, [year]);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return (
    <div>
      {/* Header with month/year selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          >
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
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

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Spend by category pie chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-base font-semibold mb-4">Spend by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={byCategory}
                dataKey="total"
                nameKey="category"
                cx="40%"
                cy="50%"
                outerRadius={100}
                label={({ category, total }) => `${category}: ${fmt(total)}`}
              >
                {byCategory.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                formatter={(value, entry) => {
                  // Sort categories by total descending
                  const sorted = [...byCategory].sort((a, b) => b.total - a.total);
                  // Find the index of this category in sorted order
                  const cat = sorted.find(c => c.category === value);
                  if (!cat) return value;
                  const total = sorted.reduce((sum, c) => sum + c.total, 0) || 1;
                  const percent = ((cat.total / total) * 100).toFixed(1);
                  return `${cat.category}: ${fmt(cat.total)} (${percent}%)`;
                }}
                // Use a custom payload to order legend items by spend
                payload={byCategory
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map(cat => ({
                    value: cat.category,
                    type: "circle",
                    color: cat.color,
                  }))}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top merchants bar chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-base font-semibold mb-4">Top Spends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topMerchants} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tickFormatter={(v) => fmt(v)} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="description"
                width={180}
                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                tickFormatter={(v) => v.length > 25 ? v.slice(0, 25) + '…' : v}
              />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="total" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly trend line chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-base font-semibold mb-4">Monthly Trend ({year})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* By account */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-base font-semibold mb-4">By Account</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byAccount}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="account" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="debit" name="Spent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="credit" name="Paid" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction Grid at the bottom */}
      <DashboardTransactionsGrid month={month} year={year} />
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
