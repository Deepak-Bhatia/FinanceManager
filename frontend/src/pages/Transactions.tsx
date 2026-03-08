import { useEffect, useState } from 'react';
import { getTransactions, getCategories, updateTransaction, deleteTransaction } from '../api';
import { Search, Trash2, Pencil, Check, X, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

type SortKey = 'date' | 'description' | 'amount' | 'type' | 'category' | 'source';
type SortDir = 'asc' | 'desc';

export default function Transactions() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 50 });
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCatId, setEditCatId] = useState<number | null>(null);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    getTransactions({ month, year, search: search || undefined, page, per_page: 50 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [month, year, search, page]);

  const startEditing = (t: any) => {
    setEditingId(t.id);
    setEditCatId(t.category_id || null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCatId(null);
  };

  const saveEditing = async () => {
    if (editingId === null) return;
    await updateTransaction(editingId, { category_id: editCatId });
    setData((prev: any) => ({
      ...prev,
      items: prev.items.map((t: any) =>
        t.id === editingId ? { ...t, category_id: editCatId } : t
      ),
    }));
    setEditingId(null);
    setEditCatId(null);
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

  const totalPages = Math.ceil(data.total / data.per_page);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const catMap = Object.fromEntries(categories.map((c: any) => [c.id, c]));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'amount' ? 'desc' : 'asc');
    }
  };

  const sortedItems = (() => {
    if (!sortKey) return data.items;
    const items = [...data.items];
    const dir = sortDir === 'asc' ? 1 : -1;
    return items.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'date': av = a.date; bv = b.date; break;
        case 'description': av = (a.description || '').toLowerCase(); bv = (b.description || '').toLowerCase(); break;
        case 'amount': av = a.amount; bv = b.amount; break;
        case 'type': av = a.type; bv = b.type; break;
        case 'category': av = (catMap[a.category_id]?.name || 'zzz').toLowerCase(); bv = (catMap[b.category_id]?.name || 'zzz').toLowerCase(); break;
        case 'source': av = (a.source_file || '').toLowerCase(); bv = (b.source_file || '').toLowerCase(); break;
      }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  })();

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm w-56"
            />
          </div>
          <select value={month} onChange={e => { setMonth(Number(e.target.value)); setPage(1); }}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1); }}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-left">
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('date')}><span className="inline-flex items-center">Date<SortIcon col="date" /></span></th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('description')}><span className="inline-flex items-center">Description<SortIcon col="description" /></span></th>
                <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}><span className="inline-flex items-center justify-end">Amount<SortIcon col="amount" /></span></th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('type')}><span className="inline-flex items-center">Type<SortIcon col="type" /></span></th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('category')}><span className="inline-flex items-center">Category<SortIcon col="category" /></span></th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('source')}><span className="inline-flex items-center">Source<SortIcon col="source" /></span></th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">Loading...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">No transactions found</td></tr>
              ) : (
                sortedItems.map((t: any) => {
                  const cat = catMap[t.category_id];
                  return (
                    <tr key={t.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">{t.date}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={t.description}>
                        <span className="inline-flex items-center gap-2">
                          {cat?.icon && <span className="text-base flex-shrink-0">{cat.icon}</span>}
                          <span className="truncate">{t.description}</span>
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${t.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                        {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${t.type === 'credit' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === t.id ? (
                          <select
                            value={editCatId || ''}
                            onChange={e => setEditCatId(Number(e.target.value) || null)}
                            className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs w-36"
                          >
                            <option value="">Uncategorized</option>
                            {categories.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          cat ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              {cat.icon && <span className="text-sm">{cat.icon}</span>}
                              <span style={{ color: cat.color }}>{cat.name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)] italic">Uncategorized</span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] max-w-[120px] truncate" title={t.source_file}>
                        {t.source_file}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {editingId === t.id ? (
                            <>
                              <button onClick={saveEditing} className="text-green-400 hover:text-green-300" title="Save">
                                <Check size={14} />
                              </button>
                              <button onClick={cancelEditing} className="text-[var(--text-secondary)] hover:text-[var(--danger)]" title="Cancel">
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEditing(t)} className="text-[var(--text-secondary)] hover:text-blue-400" title="Edit">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDelete(t.id)} className="text-[var(--text-secondary)] hover:text-red-400" title="Delete">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-secondary)]">
              Showing {(page - 1) * data.per_page + 1}-{Math.min(page * data.per_page, data.total)} of {data.total}
            </span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded hover:bg-[var(--border)] disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded hover:bg-[var(--border)] disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
