import { useEffect, useState } from 'react';
import { getCategories, updateTransaction, deleteTransaction, getEmis, getEmiAttachments, createEmiAttachments, getCreditCardCycles } from '../api';
import TransactionGrid from './TransactionGrid';
import ConfirmModal from './ConfirmModal';

export default function CreditCardTransactionsGrid({ cycle, accountId }: { cycle: string, accountId: number | null }) {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 20 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [emis, setEmis] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [cycles, setCycles] = useState<string[]>([]);

  useEffect(() => { getCategories().then(setCategories); }, []);
  useEffect(() => {
    getEmis().then((d: any) => setEmis(d.emis || []));
    getEmiAttachments().then(setAttachments);
    getCreditCardCycles().then(data => setCycles(data.map((d: any) => d.cycle)));
  }, []);
  useEffect(() => {
    if (!cycle) return;
    setLoading(true);
    fetch(`/api/creditcards/transactions?cycle=${encodeURIComponent(cycle)}${accountId ? `&account_id=${accountId}` : ''}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [cycle, accountId]);

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
    const existingMeta: Record<string, string> = {};
    (data.items.find((t: any) => t.id === editingId)?.tags_meta || []).forEach((m: any) => {
      existingMeta[m.name] = m.type;
    });
    const tagsList = editTags.split(',').map((t: string) => t.trim()).filter(Boolean);
    const newTagsMeta = JSON.stringify(tagsList.map(name => ({ name, type: existingMeta[name] || 'manual' })));
    await updateTransaction(editingId, { category_id: editCatId, tags: editTags, tags_meta: newTagsMeta });
    setData((prev: any) => ({
      ...prev,
      items: prev.items.map((t: any) =>
        t.id === editingId ? { ...t, category_id: editCatId, tags: editTags, tags_meta: JSON.parse(newTagsMeta) } : t
      ),
    }));
    setEditingId(null);
    setEditCatId(null);
    setEditTags('');
  };

  const handleDelete = (txnId: number) => setPendingDeleteId(txnId);

  const handleAttach = async (transactionIds: number[], emiId: number, emiCycle: string) => {
    await createEmiAttachments({ emi_id: emiId, cycle: emiCycle, transaction_ids: transactionIds });
    const updated = await getEmiAttachments();
    setAttachments(updated);
  };

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
      <h3 className="text-lg font-semibold mb-3">Credit Card Transactions</h3>
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
          emis={emis}
          attachments={attachments}
          cycles={cycles}
          onAttach={handleAttach}
          initialShowTop={true}
          initialShowRecent={false}
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
