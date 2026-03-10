import { useEffect, useState } from 'react';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '../api';
import TransactionGrid from '../components/TransactionGrid';
import ConfirmModal from '../components/ConfirmModal';

export default function DashboardTransactionsGrid({ month, year, hideIgnored = true }: { month: number, year: number, hideIgnored?: boolean }) {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 50 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => { getCategories().then(setCategories); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getTransactions({ month, year, page: 1, per_page: 1000, hide_ignored: hideIgnored })
      .then(d => { if (!controller.signal.aborted) setData(d); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [month, year, hideIgnored]);

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

  const handleDelete = (txnId: number) => setPendingDeleteId(txnId);

  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    await deleteTransaction(pendingDeleteId);
    setData((prev: any) => ({
      ...prev,
      items: prev.items.filter((t: any) => t.id !== pendingDeleteId),
      total: prev.total - 1,
    }));
    setPendingDeleteId(null);
  };

  return (
    <div className="mt-10">
      <h3 className="text-lg font-semibold mb-3">Transactions</h3>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
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
          showActions={true}
          initialShowRecent={false}
          initialShowTop={false}
        />
      </div>

      <ConfirmModal
        open={pendingDeleteId !== null}
        title="Delete Transaction"
        message="This transaction will be permanently deleted and cannot be recovered."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
