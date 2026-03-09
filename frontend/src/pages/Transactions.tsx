import { useEffect, useState } from 'react';
import { getTransactions, getCategories, updateTransaction, deleteTransaction, getEmis, getEmiAttachments, createEmiAttachments, getCreditCardCycles } from '../api';
import TransactionGrid from '../components/TransactionGrid';
import ConfirmModal from '../components/ConfirmModal';
import { Search, X } from 'lucide-react';

const MONTHS = [
  { v: '', l: 'All Months' },
  ...Array.from({ length: 12 }, (_, i) => ({
    v: String(i + 1),
    l: new Date(2000, i).toLocaleString('en-IN', { month: 'short' }),
  })),
];

const CUR_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CUR_YEAR - 2 + i);
const PER_PAGE = 50;

type SortKey = 'date' | 'description' | 'amount' | 'type' | 'category' | 'source' | 'tags';

export default function Transactions() {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: PER_PAGE });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editTags, setEditTags] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [emis, setEmis] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [cycles, setCycles] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    month: '',
    year: String(CUR_YEAR),
    type: '',
    account_type: '',
    search: '',
    tag: '',
  });

  useEffect(() => { getCategories().then(setCategories); }, []);

  useEffect(() => {
    getEmis().then((d: any) => setEmis(d.emis || []));
    getEmiAttachments().then(setAttachments);
    getCreditCardCycles().then(data => setCycles(data.map((d: any) => d.cycle)));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, any> = { page, per_page: PER_PAGE };
    if (filters.month) params.month = Number(filters.month);
    if (filters.year) params.year = Number(filters.year);
    if (filters.type) params.type = filters.type;
    if (filters.account_type) params.account_type = filters.account_type;
    if (filters.search) params.search = filters.search;
    if (filters.tag) params.tag = filters.tag;
    getTransactions(params).then(setData).finally(() => setLoading(false));
  }, [page, filters]);

  const setFilter = (key: string, val: string) => {
    setPage(1);
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({ month: '', year: String(CUR_YEAR), type: '', account_type: '', search: '', tag: '' });
  };

  const hasActive = filters.month || filters.type || filters.account_type || filters.search || filters.tag;

  const startEditing = (t: any) => {
    setEditingId(t.id);
    setEditCatId(t.category_id || null);
    setEditTags(t.tags || '');
  };
  const cancelEditing = () => { setEditingId(null); setEditCatId(null); setEditTags(''); };
  const saveEditing = async () => {
    if (editingId === null) return;
    // Preserve existing tag types, new tags default to "manual"
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
        t.id === editingId
          ? { ...t, category_id: editCatId, tags: editTags, tags_meta: JSON.parse(newTagsMeta) }
          : t
      ),
    }));
    setEditingId(null); setEditCatId(null); setEditTags('');
  };

  const handleDelete = (id: number) => setPendingDeleteId(id);

  const handleAttach = async (transactionIds: number[], emiId: number, cycle: string) => {
    await createEmiAttachments({ emi_id: emiId, cycle, transaction_ids: transactionIds });
    // Refresh attachments list
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

  const totalPages = Math.ceil(data.total / PER_PAGE);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={filters.month}
          onChange={e => setFilter('month', e.target.value)}
          className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm"
        >
          {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
        </select>

        <select
          value={filters.year}
          onChange={e => setFilter('year', e.target.value)}
          className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm"
        >
          <option value="">All Years</option>
          {YEARS.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>

        <select
          value={filters.type}
          onChange={e => setFilter('type', e.target.value)}
          className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm"
        >
          <option value="">All Types</option>
          <option value="debit">Debits</option>
          <option value="credit">Credits</option>
        </select>

        <select
          value={filters.account_type}
          onChange={e => setFilter('account_type', e.target.value)}
          className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm"
        >
          <option value="">All Accounts</option>
          <option value="savings">Savings Bank</option>
          <option value="credit_card">Credit Card</option>
          <option value="current">Current Account</option>
        </select>

        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search description..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm"
          />
        </div>

        <input
          type="text"
          placeholder="Filter by tag..."
          value={filters.tag}
          onChange={e => setFilter('tag', e.target.value)}
          className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm min-w-[150px]"
        />

        {hasActive && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-lg transition-colors"
          >
            <X size={14} /> Clear
          </button>
        )}

        <span className="text-xs text-[var(--text-secondary)] ml-auto">
          {data.total.toLocaleString()} total
        </span>
      </div>

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
        onSortChange={(key) => setSortKey(key as SortKey)}
        showActions={true}
        emis={emis}
        attachments={attachments}
        cycles={cycles}
        onAttach={handleAttach}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-sm text-[var(--text-secondary)]">
            Page {page} of {totalPages} &middot; {data.total.toLocaleString()} transactions
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg disabled:opacity-40 hover:bg-[var(--bg-secondary)]"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg disabled:opacity-40 hover:bg-[var(--bg-secondary)]"
            >
              Next
            </button>
          </div>
        </div>
      )}

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
