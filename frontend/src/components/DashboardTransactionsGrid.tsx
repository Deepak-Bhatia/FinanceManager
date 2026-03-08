import { useEffect, useState } from 'react';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '../api';
import TransactionGrid from '../components/TransactionGrid';

export default function DashboardTransactionsGrid({ month, year }: { month: number, year: number }) {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 10 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string>('');

  useEffect(() => { getCategories().then(setCategories); }, []);
  useEffect(() => {
    setLoading(true);
    getTransactions({ month, year, page: 1, per_page: 10 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [month, year]);

  const startEditing = (t: any) => {
    setEditingId(t.id);
    setEditCatId(t.category_id || null);
    setEditTags(t.tags || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCatId(null);
    setEditTags('');
  };

  const saveEditing = async () => {
    if (editingId === null) return;
    await updateTransaction(editingId, { category_id: editCatId, tags: editTags });
    setData((prev: any) => ({
      ...prev,
      items: prev.items.map((t: any) =>
        t.id === editingId ? { ...t, category_id: editCatId, tags: editTags } : t
      ),
    }));
    setEditingId(null);
    setEditCatId(null);
    setEditTags('');
  };

  const handleDelete = async (txnId: number) => {
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(txnId);
    setData((prev: any) => ({
      ...prev,
      items: prev.items.filter((t: any) => t.id !== txnId),
      total: prev.total - 1,
    }));
  };

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
          editingId={editingId}
          editCatId={editCatId}
          editTags={editTags}
          onEditStart={startEditing}
          onEditCancel={cancelEditing}
          onEditSave={saveEditing}
          onEditCatChange={setEditCatId}
          onEditTagsChange={setEditTags}
          onDelete={handleDelete}
          showActions={true}
          initialShowRecent={false}
          initialShowTop={true}
        />
      </div>
    </div>
  );
}
