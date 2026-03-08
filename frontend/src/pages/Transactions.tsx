import { useEffect, useState } from 'react';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '../api';

import TransactionGrid from '../components/TransactionGrid';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

type SortKey = 'date' | 'description' | 'amount' | 'type' | 'category' | 'source' | 'tags';
type SortDir = 'asc' | 'desc';

export default function Transactions() {
  // Removed unused month, year, search, page
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 50 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  // Removed unused accountType

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    getTransactions({})
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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

  // Removed unused catMap

  // Removed unused toggleSort

  // Removed unused sortedItems

  return (
    <TransactionGrid
      items={data.items}
      categories={categories}
      loading={loading}
      editingId={editingId}
      editCatId={editCatId}
      editTags={editTags}
      onEditStart={startEditing}
      onEditCancel={cancelEditing}
      onEditSave={saveEditing}
      onEditCatChange={setEditCatId}
      onEditTagsChange={setEditTags}
      onDelete={handleDelete}
      sortKey={sortKey}
      // sortDir removed
      onSortChange={(key) => setSortKey(key as SortKey)}
      showActions={true}
    />
  );
}
