import { useEffect, useState } from 'react';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '../api';
import TransactionGrid from './TransactionGrid';
import ConfirmModal from './ConfirmModal';

export default function DebitCardTransactionsGrid({ params }: { params: Record<string, any> }) {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 50 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [editCustomDesc, setEditCustomDesc] = useState<string>('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  useEffect(() => { getCategories().then(setCategories); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getTransactions({ ...params, page: 1, per_page: 5000 })
      .then(d => { if (!controller.signal.aborted) setData(d); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [JSON.stringify(params)]);

  const startEditing = (t: any) => {
    setEditingId(t.id);
    setEditCatId(t.category_id || null);
    setEditTags(t.tags || '');
    setEditCustomDesc(t.custom_description || t.description || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCatId(null);
    setEditTags('');
    setEditCustomDesc('');
  };

  const saveEditing = async () => {
    if (editingId === null) return;
    const txn = data.items.find((t: any) => t.id === editingId);
    const existingMeta: Record<string, string> = {};
    (txn?.tags_meta || []).forEach((m: any) => { existingMeta[m.name] = m.type; });
    const tagsList = editTags.split(',').map((t: string) => t.trim()).filter(Boolean);
    const newTagsMeta = JSON.stringify(tagsList.map(name => ({ name, type: existingMeta[name] || 'manual' })));
    const customDesc = editCustomDesc.trim() === (txn?.description || '').trim() ? null : editCustomDesc.trim() || null;
    await updateTransaction(editingId, { category_id: editCatId, tags: editTags, tags_meta: newTagsMeta, custom_description: customDesc });
    setData((prev: any) => ({
      ...prev,
      items: prev.items.map((t: any) =>
        t.id === editingId
          ? { ...t, category_id: editCatId, tags: editTags, tags_meta: JSON.parse(newTagsMeta), custom_description: customDesc }
          : t
      ),
    }));
    setEditingId(null);
    setEditCatId(null);
    setEditTags('');
    setEditCustomDesc('');
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
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3">Debit Card Transactions</h3>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <TransactionGrid
          items={data.items}
          categories={categories}
          loading={loading}
          editingId={editingId}
          editCatId={editCatId}
          editTags={editTags}
          editCustomDesc={editCustomDesc}
          onEditStart={startEditing}
          onEditCancel={cancelEditing}
          onEditSave={saveEditing}
          onEditCatChange={setEditCatId}
          onEditTagsChange={setEditTags}
          onEditCustomDescChange={setEditCustomDesc}
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
