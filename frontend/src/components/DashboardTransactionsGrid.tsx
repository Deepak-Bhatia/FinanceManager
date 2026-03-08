import { useEffect, useState } from 'react';
import { getTransactions, getCategories } from '../api';
import TransactionGrid from '../components/TransactionGrid';

export default function DashboardTransactionsGrid({ month, year }: { month: number, year: number }) {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 10 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { getCategories().then(setCategories); }, []);
  useEffect(() => {
    setLoading(true);
    getTransactions({ month, year, page: 1, per_page: 10 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [month, year]);

  return (
    <div className="mt-10">
      <h3 className="text-lg font-semibold mb-3">Transactions</h3>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <TransactionGrid
          items={data.items}
          categories={categories}
          loading={loading}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={setSortKey}
          showActions={false}
        />
      </div>
    </div>
  );
}
