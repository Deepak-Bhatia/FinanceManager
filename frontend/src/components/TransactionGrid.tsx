import { useMemo, useState, useRef } from 'react';
import { Pencil, Trash2, Check, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { generateInstallments } from '../pages/EMIs';

const fmt = (n: number) => '\u20b9' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

function TagInput({ value, onChange }: { value: string, onChange?: (val: string) => void }) {
  const [input, setInput] = useState('');
  const tags = value.split(',').map(t => t.trim()).filter(Boolean);
  const inputRef = useRef(null as HTMLInputElement | null);

  const addTag = (tag: string) => {
    const newTag = tag.trim();
    if (!newTag || tags.includes(newTag)) return;
    onChange?.([...tags, newTag].join(','));
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const removeTag = (idx: number) => {
    onChange?.(tags.filter((_, i) => i !== idx).join(','));
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const handleKeyDown = (e: any) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); addTag(input); }
    else if (e.key === 'Backspace' && !input && tags.length > 0) removeTag(tags.length - 1);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border border-[var(--border)] rounded px-2 py-1 bg-[var(--bg-primary)] min-h-[36px]">
      {tags.map((tag, idx) => (
        <span key={idx} className="bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
          {tag}
          <button type="button" className="ml-1 text-white hover:text-gray-200 focus:outline-none" onClick={() => removeTag(idx)}>×</button>
        </span>
      ))}
      <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
        className="outline-none border-none bg-transparent text-xs min-w-[60px] flex-1 py-1"
        placeholder={tags.length === 0 ? 'Add tag...' : ''} aria-label="Add tag" />
    </div>
  );
}

export type TransactionGridProps = {
  items: any[];
  categories: any[];
  loading?: boolean;
  editingId?: number | null;
  editCatId?: number | null;
  editTags?: string;
  editCustomDesc?: string;
  onEditStart?: (txn: any) => void;
  onEditCancel?: () => void;
  onEditSave?: () => void;
  onEditCatChange?: (catId: number | null) => void;
  onEditTagsChange?: (tags: string) => void;
  onEditCustomDescChange?: (val: string) => void;
  onDelete?: (txnId: number) => void;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  showActions?: boolean;
  initialShowRecent?: boolean;
  initialShowTop?: boolean;
  // EMI
  emis?: any[];
  attachments?: any[];
  cycles?: string[];
  onAttach?: (transactionIds: number[], emiId: number, cycle: string) => Promise<void>;
};

export default function TransactionGrid({
  items = [], categories = [], loading,
  editingId, editCatId, editTags, editCustomDesc,
  onEditStart, onEditCancel, onEditSave, onEditCatChange, onEditTagsChange, onEditCustomDescChange,
  onDelete,
  sortKey: propSortKey, sortDir: propSortDir, onSortChange: propOnSortChange,
  showActions = true, initialShowRecent, initialShowTop,
  emis = [], attachments = [], cycles = [], onAttach,
}: TransactionGridProps) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c: any) => [c.id, c])), [categories]);

  // Sorting
  const [localSortKey, setLocalSortKey] = useState<string | null>(null);
  const [localSortDir, setLocalSortDir] = useState<'asc' | 'desc'>('asc');
  const sortKey = propSortKey ?? localSortKey;
  const sortDir = propSortDir ?? localSortDir;
  const onSortChange = propOnSortChange ?? ((key: string) => {
    if (localSortKey === key) setLocalSortDir(localSortDir === 'asc' ? 'desc' : 'asc');
    else { setLocalSortKey(key); setLocalSortDir('asc'); }
  });

  // Filter/search
  const [search, setSearch] = useState('');
  const [showRecent, setShowRecent] = useState(initialShowRecent ?? true);
  const [showTop, setShowTop] = useState(initialShowTop ?? false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // EMI modal state
  const [showMarkEmi, setShowMarkEmi] = useState(false);
  const [showEmiList, setShowEmiList] = useState(false);
  const [markEmiId, setMarkEmiId] = useState<number | null>(null);
  const [markCycle, setMarkCycle] = useState('');
  const [markLoading, setMarkLoading] = useState(false);

  const closeMarkEmi = () => { setShowMarkEmi(false); setMarkEmiId(null); setMarkCycle(''); };

  // Filtering + sorting + slicing
  let filtered = items;
  if (search.trim()) {
    const s = search.trim().toLowerCase();
    filtered = filtered.filter(t =>
      (t.date && t.date.toLowerCase().includes(s)) ||
      (t.custom_description && t.custom_description.toLowerCase().includes(s)) ||
      (t.description && t.description.toLowerCase().includes(s)) ||
      (t.amount && String(t.amount).toLowerCase().includes(s)) ||
      (t.type && t.type.toLowerCase().includes(s)) ||
      (catMap[t.category_id]?.name && catMap[t.category_id].name.toLowerCase().includes(s)) ||
      (t.tags && t.tags.toLowerCase().includes(s)) ||
      (t.source_file && t.source_file.toLowerCase().includes(s))
    );
  }
  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      let av = sortKey === 'category' ? (catMap[a.category_id]?.name || '') : a[sortKey];
      let bv = sortKey === 'category' ? (catMap[b.category_id]?.name || '') : b[sortKey];
      if (sortKey === 'amount') { av = Number(av); bv = Number(bv); }
      if (av == null) av = ''; if (bv == null) bv = '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  if (showRecent && !showTop) filtered = filtered.slice(0, 20);
  else if (showTop && !showRecent) {
    const spends = filtered.filter(t => (t.type || '').toLowerCase() !== 'credit' && !(t.tags || '').split(',').map((s: string) => s.trim().toLowerCase()).includes('ignore'));
    filtered = [...spends].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 20);
  } else if (showRecent && showTop) {
    const recent = filtered.slice(0, 20).filter(t => (t.type || '').toLowerCase() !== 'credit' && !(t.tags || '').split(',').map((s: string) => s.trim().toLowerCase()).includes('ignore'));
    filtered = [...recent].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 20);
  }

  // Selection helpers
  const filteredIds = filtered.map(t => t.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const s = new Set(prev); filteredIds.forEach(id => s.delete(id)); return s; });
    } else {
      setSelectedIds(prev => { const s = new Set(prev); filteredIds.forEach(id => s.add(id)); return s; });
    }
  };
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // Set of transaction IDs that have at least one EMI attachment
  const emiLinkedIds = useMemo(
    () => new Set(attachments.map((a: any) => a.transaction_id)),
    [attachments]
  );
  const allItemIds = useMemo(() => new Set(items.map(t => t.id)), [items]);
  const relevantAttachments = useMemo(
    () => attachments.filter(a => allItemIds.has(a.transaction_id)),
    [attachments, allItemIds]
  );
  const emiCount = useMemo(
    () => new Set(relevantAttachments.map(a => `${a.emi_id}::${a.cycle}`)).size,
    [relevantAttachments]
  );

  // EMI list modal — group by emi_id+cycle
  const emiGroups = useMemo(() => {
    const map = new Map<string, { emi_id: number; emi_product_name: string; emi_monthly: number; cycle: string; txnCount: number }>();
    for (const a of relevantAttachments) {
      const key = `${a.emi_id}::${a.cycle}`;
      if (!map.has(key)) map.set(key, { emi_id: a.emi_id, emi_product_name: a.emi_product_name, emi_monthly: a.emi_monthly, cycle: a.cycle, txnCount: 0 });
      map.get(key)!.txnCount++;
    }
    return Array.from(map.values());
  }, [relevantAttachments]);

  const handleAttach = async () => {
    if (!markEmiId || !markCycle || !onAttach) return;
    setMarkLoading(true);
    try {
      await onAttach([...selectedIds], markEmiId, markCycle);
      setSelectedIds(new Set());
      closeMarkEmi();
    } finally {
      setMarkLoading(false);
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />;
  };

  const colSpan = showActions ? 9 : 8;

  return (
    <div className="overflow-x-auto">
      {/* Filter/search bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search transactions..."
          className="border border-[var(--border)] rounded px-2 py-1 text-sm w-56 bg-[var(--bg-primary)]" />
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
          <input type="checkbox" checked={showRecent} onChange={e => setShowRecent(e.target.checked)} /> Recent 20
        </label>
        <label className="inline-flex items-center gap-1 text-xs cursor-pointer">
          <input type="checkbox" checked={showTop} onChange={e => setShowTop(e.target.checked)} /> Top 20 Spends
        </label>

        <div className="flex items-center gap-2 ml-auto">
          {/* Mark as EMI — visible only when rows are selected */}
          {selectedIds.size > 0 && (
            <button onClick={() => setShowMarkEmi(true)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-600 transition-colors">
              Mark as EMI
              <span className="bg-purple-500 rounded-full px-1.5 py-0.5 text-[10px]">{selectedIds.size}</span>
            </button>
          )}

          {/* EMI count button — always visible when EMI feature is enabled */}
          {onAttach !== undefined && (
            <button onClick={() => setShowEmiList(true)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium border border-[var(--border)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors">
              EMI
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${emiCount > 0 ? 'bg-blue-600 text-white' : 'bg-[var(--border)] text-[var(--text-secondary)]'}`}>
                {emiCount}
              </span>
            </button>
          )}

          <span className="text-xs text-[var(--text-secondary)]">Showing {filtered.length} of {items.length}</span>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-left">
            <th className="px-3 py-3 w-8">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                className="cursor-pointer accent-[var(--accent)]"
                title={allSelected ? 'Deselect all' : 'Select all visible'} />
            </th>
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
            <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-[var(--text-secondary)]">Loading...</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-[var(--text-secondary)]">No transactions found</td></tr>
          ) : (
            filtered.map((t: any) => {
              const isIgnored = ((t.tags || '') as string).toLowerCase().split(',').map(s => s.trim()).includes('ignore');
              const cat = catMap[t.category_id];
              const isSelected = selectedIds.has(t.id);
              const isEmi = emiLinkedIds.has(t.id);
              return (
                <tr key={t.id}
                  className={`border-b border-[var(--border)] transition-colors ${isIgnored ? 'opacity-50' : ''} ${
                    isSelected
                      ? 'bg-blue-50/30'
                      : isEmi
                        ? 'bg-amber-500/10 hover:bg-amber-500/15'
                        : 'hover:bg-[var(--bg-primary)]'
                  }`}
                  title={isIgnored ? 'Ignored transaction — excluded from calculations' : isEmi ? 'Linked to an EMI' : undefined}
                >
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)}
                      className="cursor-pointer accent-[var(--accent)]" />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-3 max-w-xs overflow-hidden" title={t.custom_description ? t.description : undefined}>
                    {editingId === t.id ? (
                      <input
                        type="text"
                        value={editCustomDesc ?? ''}
                        onChange={e => onEditCustomDescChange?.(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') onEditSave?.(); if (e.key === 'Escape') onEditCancel?.(); }}
                        autoFocus
                        className="w-full px-2 py-1 text-sm border border-[var(--accent)] rounded bg-[var(--bg-primary)] outline-none"
                        placeholder={t.description}
                      />
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{t.custom_description || t.description}</span>
                      </div>
                    )}
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
                      <select value={editCatId || ''} onChange={e => onEditCatChange?.(Number(e.target.value) || null)}
                        className="bg-[var(--bg-primary)] border border-[var(--border)] rounded px-2 py-1 text-xs w-36">
                        <option value="">Uncategorized</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
                      </select>
                    ) : cat ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {cat.icon && <span className="text-sm">{cat.icon}</span>}
                        <span style={{ color: cat.color }}>{cat.name}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-secondary)] italic">Uncategorized</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[260px]">
                    {editingId === t.id ? (
                      <TagInput value={editTags ?? ''} onChange={onEditTagsChange} />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const meta: { name: string; type: string }[] = t.tags_meta || [];
                          return (t.tags || '').split(',').filter(Boolean).map((tag: string, idx: number) => {
                            const isAuto = (meta.find(m => m.name === tag.trim())?.type || 'manual') === 'auto';
                            return (
                              <span key={idx} title={isAuto ? 'Auto-generated' : 'User-added'}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 max-w-[100px] ${isAuto ? 'bg-purple-700/80 text-white' : 'bg-blue-700 text-white'}`}>
                                <span className="text-[9px] opacity-80 flex-shrink-0">{isAuto ? '⚙' : '👤'}</span>
                                <span className="truncate">{tag.trim()}</span>
                              </span>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] max-w-[140px]" title={t.source_file}>
                    <span className="inline-flex items-center gap-1.5 truncate">
                      {t.account_glyph && <span className="text-sm flex-shrink-0">{t.account_glyph}</span>}
                      <span className="truncate">{t.source_file}</span>
                    </span>
                  </td>
                  {showActions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {editingId === t.id ? (
                          <>
                            <button onClick={onEditSave} className="text-green-400 hover:text-green-300" title="Save"><Check size={14} /></button>
                            <button onClick={onEditCancel} className="text-[var(--text-secondary)] hover:text-[var(--danger)]" title="Cancel"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => onEditStart?.(t)} className="text-[var(--text-secondary)] hover:text-blue-400" title="Edit"><Pencil size={14} /></button>
                            <button onClick={() => onDelete?.(t.id)} className="text-[var(--text-secondary)] hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* ── Mark as EMI modal ─────────────────────────────────────────────── */}
      {showMarkEmi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeMarkEmi}>
          <div className="bg-[var(--bg-card)] rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-base">Mark as EMI</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
                </p>
              </div>
              <button onClick={closeMarkEmi} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-5">
              {/* Step 1 — Select EMI */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                  1 · Select EMI
                </label>
                {emis.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)] py-2">No EMIs found. Import a credit card statement to detect EMIs.</p>
                ) : (
                  <select
                    value={markEmiId ?? ''}
                    onChange={e => { setMarkEmiId(Number(e.target.value) || null); setMarkCycle(''); }}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)] cursor-pointer"
                  >
                    <option value="">— Choose an EMI —</option>
                    {emis.map((emi: any) => (
                      <option key={emi.id} value={emi.id}>
                        {emi.product_name} · {emi.card} · ₹{(emi.monthly_emi || 0).toLocaleString('en-IN')}/mo
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Step 2 — Select Installment (only after EMI picked) */}
              {markEmiId && (() => {
                const selectedEmi = emis.find((e: any) => e.id === markEmiId);
                const installments = selectedEmi ? generateInstallments(selectedEmi, attachments) : [];
                const statusStyle: Record<string, { cls: string; dot: string }> = {
                  paid:     { cls: 'border-green-500/40 bg-green-500/10 text-green-500',       dot: '✓' },
                  current:  { cls: 'border-blue-400/40 bg-blue-400/10 text-blue-400',          dot: '●' },
                  upcoming: { cls: 'border-[var(--border)] text-[var(--text-secondary)]',       dot: '○' },
                  missed:   { cls: 'border-orange-400/40 bg-orange-400/10 text-orange-400',    dot: '!' },
                };
                return (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                      2 · Select Installment
                    </label>
                    {installments.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">
                        No schedule found — set a valid Booking Month on this EMI first.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {installments.map(inst => {
                          const st = statusStyle[inst.status];
                          const isSelected = markCycle === inst.cycleStr;
                          return (
                            <button key={inst.cycleStr} onClick={() => setMarkCycle(inst.cycleStr)}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                                  : st.cls
                              }`}>
                              <span className="text-[10px]">{st.dot}</span>
                              <span className="font-medium">EMI {inst.index}</span>
                              <span className="opacity-75">· {inst.cycleStr}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end gap-2 shrink-0">
              <button onClick={closeMarkEmi}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAttach}
                disabled={!markEmiId || !markCycle || markLoading}
                className="px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {markLoading ? 'Saving…' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMI list modal (current filter) ───────────────────────────────── */}
      {showEmiList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEmiList(false)}>
          <div className="bg-[var(--bg-card)] rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-base">EMIs in Current View</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {emiGroups.length} EMI cycle{emiGroups.length !== 1 ? 's' : ''} linked to these transactions
                </p>
              </div>
              <button onClick={() => setShowEmiList(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {emiGroups.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
                  No EMIs are linked to transactions in the current view.
                  <br />
                  <span className="text-[10px] mt-1 block">Select transactions and click "Mark as EMI" to link them.</span>
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-xs text-left">
                      <th className="px-5 py-2">EMI</th>
                      <th className="px-5 py-2">Cycle</th>
                      <th className="px-5 py-2">Monthly</th>
                      <th className="px-5 py-2">Txns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emiGroups.map((g, i) => (
                      <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
                        <td className="px-5 py-3 font-medium">{g.emi_product_name}</td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">{g.cycle}</td>
                        <td className="px-5 py-3">₹{(g.emi_monthly || 0).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3">
                          <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{g.txnCount}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
