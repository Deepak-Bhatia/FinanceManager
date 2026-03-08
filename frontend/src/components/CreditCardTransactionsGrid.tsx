import { useEffect, useState } from 'react';
import { getCategories } from '../api';
import TransactionGrid from './TransactionGrid';

export default function CreditCardTransactionsGrid({ cycle, accountId }: { cycle: string, accountId: number | null }) {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 20 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { getCategories().then(setCategories); }, []);
  useEffect(() => {
    if (!cycle) return;
    setLoading(true);
    fetch(`/api/creditcards/transactions?cycle=${encodeURIComponent(cycle)}${accountId ? `&account_id=${accountId}` : ''}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [cycle, accountId]);

  return (
    <div className="mt-10">
      <h3 className="text-lg font-semibold mb-3">Credit Card Transactions</h3>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <TransactionGrid
          items={data.items}
          categories={categories}
          loading={loading}
          showActions={false}
        />
      </div>
    </div>
  );
}
