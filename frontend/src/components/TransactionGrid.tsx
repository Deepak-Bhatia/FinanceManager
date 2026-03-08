import { useMemo, useState } from 'react';
import { Pencil, Trash2, Check, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const fmt = (n: number) => '\u20b9' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export type TransactionGridProps = {
  items: any[];
  categories: any[];
  loading?: boolean;
  editingId?: number | null;
  editCatId?: number | null;
  editTags?: string;
  onEditStart?: (txn: any) => void;
  onEditCancel?: () => void;
  onEditSave?: () => void;
  onEditCatChange?: (catId: number | null) => void;
  onEditTagsChange?: (tags: string) => void;
  onDelete?: (txnId: number) => void;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  showActions?: boolean;
};

export default function TransactionGrid({
  items = [],
  categories = [],
  loading,
  editingId,
  editCatId,
  editTags,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditCatChange,
  onEditTagsChange,
  onDelete,
  sortKey: propSortKey,
  sortDir: propSortDir,
  onSortChange: propOnSortChange,
  showActions = true,
}: TransactionGridProps) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c: any) => [c.id, c])), [categories]);


  // Sorting state (controlled or uncontrolled)
  const [localSortKey, setLocalSortKey] = useState<string | null>(null);
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>('asc');
  const sortKey = propSortKey ?? localSortKey;
  const sortDir = propSortDir ?? localSortDir;
  const onSortChange = propOnSortChange ?? ((key: string) => {
    if (localSortKey === key) {
      setLocalSortDir(localSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalSortKey(key);
      setLocalSortDir('asc');
    }
  });

  // Filter/search state
  const [search, setSearch] = useState('');
  const [showRecent, setShowRecent] = useState(true);
  const [showTop, setShowTop] = useState(false);

  // Filtered, sorted, and sliced items
  let filtered = items;
  if (search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(t =>
      (t.date && t.date.toLowerCase().includes(s)) ||
      (t.description && t.description.toLowerCase().includes(s)) ||
      (t.amount && String(t.amount).toLowerCase().includes(s)) ||
      (t.type && t.type.toLowerCase().includes(s)) ||
      (catMap[t.category_id]?.name && catMap[t.category_id].name.toLowerCase().includes(s)) ||
      (t.source_file && t.source_file.toLowerCase().includes(s))
    );
  }
  // Sorting logic
  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      // Special handling for category
      if (sortKey === 'category') {
        av = catMap[a.category_id]?.name || '';
        bv = catMap[b.category_id]?.name || '';
      }
      // Special handling for amount
      if (sortKey === 'amount') {
        av = Number(av);
        bv = Number(bv);
      }
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  if (showRecent && !showTop) {
    filtered = filtered.slice(0, 20);
  } else if (showTop && !showRecent) {
    filtered = [...filtered].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 20);
  } else if (showRecent && showTop) {
    // If both checked, show intersection (top 20 of recent 20)
    const recent = filtered.slice(0, 20);
    filtered = [...recent].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 20);
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />;
  };

  return (
    <div className="overflow-x-auto">
      {/* Filter/search row */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search transactions..."
          className="border border-[var(--border)] rounded px-2 py-1 text-sm w-56 bg-[var(--bg-primary)]"
        />
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
          <input type="checkbox" checked={showRecent} onChange={e => setShowRecent(e.target.checked)} />
          Recent 20
        </label>
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
          <input type="checkbox" checked={showTop} onChange={e => setShowTop(e.target.checked)} />
          Top 20 Spends
        </label>
        <span className="text-xs text-[var(--text-secondary)] ml-auto">Showing {filtered.length} of {items.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-left">
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onSortChange?.('date')}><span className="inline-flex items-center">Date<SortIcon col="date" /></span></th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onSortChange?.('description')}><span className="inline-flex items-center">Description<SortIcon col="description" /></span></th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onSortChange?.('amount')}><span className="inline-flex items-center">Amount<SortIcon col="amount" /></span></th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onSortChange?.('type')}><span className="inline-flex items-center">Type<SortIcon col="type" /></span></th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onSortChange?.('category')}><span className="inline-flex items-center">Category<SortIcon col="category" /></span></th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onSortChange?.('tags')}><span className="inline-flex items-center">Tags<SortIcon col="tags" /></span></th>
            <th className="px-4 py-3 cursor-pointer select-none" onClick={() => onSortChange?.('source')}><span className="inline-flex items-center">Source<SortIcon col="source" /></span></th>
            {showActions && <th className="px-4 py-3 w-20"></th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={showActions ? 7 : 6} className="px-4 py-8 text-center text-[var(--text-secondary)]">Loading...</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={showActions ? 7 : 6} className="px-4 py-8 text-center text-[var(--text-secondary)]">No transactions found</td></tr>
          ) : (
            filtered.map((t: any) => {
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
                  <td className={`px-4 py-3 font-medium whitespace-nowrap ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <select
                        value={editCatId || ''}
                        onChange={e => onEditCatChange?.(Number(e.target.value) || null)}
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
                  {/* Tags column */}
                  <td className="px-4 py-3 text-xs max-w-[160px]">
                    {editingId === t.id ? (
                      <input
                        type="text"
                        value={editTags ?? ''}
                        onChange={e => onEditTagsChange?.(e.target.value)}
                        className="border border-[var(--border)] rounded px-2 py-1 text-xs w-36 bg-[var(--bg-primary)]"
                        placeholder="Comma separated (e.g. food,groceries)"
                        title="Separate multiple tags with commas"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(t.tags || '').split(',').filter(Boolean).map((tag: string, idx: number) => (
                          <span key={idx} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium truncate max-w-[60px]" title={tag.trim()}>{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] max-w-[120px] truncate" title={t.source_file}>
                    {t.source_file}
                  </td>
                  {showActions && <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {editingId === t.id ? (
                        <>
                          <button onClick={onEditSave} className="text-green-400 hover:text-green-300" title="Save">
                            <Check size={14} />
                          </button>
                          <button onClick={onEditCancel} className="text-[var(--text-secondary)] hover:text-[var(--danger)]" title="Cancel">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onEditStart?.(t)} className="text-[var(--text-secondary)] hover:text-blue-400" title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => onDelete?.(t.id)} className="text-[var(--text-secondary)] hover:text-red-400" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
