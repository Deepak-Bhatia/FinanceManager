import { CSSProperties, useEffect, useRef, useState } from 'react';
import { getTags, patchTag, deleteTag, runAutoTag } from '../api';
import ConfirmModal from '../components/ConfirmModal';

type Tag = { name: string; type: 'manual' | 'auto'; count: number; color: string | null };
type Filter = 'all' | 'manual' | 'auto';

const PALETTE = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#10B981', '#14B8A6', '#06B6D4', '#64748B',
];

function tagStyle(tag: Tag): CSSProperties {
  if (tag.color) return { backgroundColor: tag.color, color: '#fff' };
  return {};
}

function tagCls(tag: Tag): string {
  if (tag.color) return 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium';
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
    tag.type === 'auto' ? 'bg-purple-700/80 text-white' : 'bg-blue-700 text-white'
  }`;
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [autoTagging, setAutoTagging] = useState(false);
  const [autoTagResult, setAutoTagResult] = useState<any | null>(null);
  const [colorPickerTag, setColorPickerTag] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    getTags().then(setTags).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Close picker on outside click
  useEffect(() => {
    if (!colorPickerTag) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColorPickerTag(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickerTag]);

  const handleTypeChange = async (name: string, newType: 'manual' | 'auto') => {
    setSavingType(name);
    setTags(prev => prev.map(t => t.name === name ? { ...t, type: newType } : t));
    try {
      await patchTag(name, { type: newType });
    } catch {
      load();
    } finally {
      setSavingType(null);
    }
  };

  const handleColorChange = async (name: string, color: string | null) => {
    setTags(prev => prev.map(t => t.name === name ? { ...t, color } : t));
    setColorPickerTag(null);
    try {
      await patchTag(name, { color: color ?? '' });
    } catch {
      load();
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    await deleteTag(pendingDelete);
    setTags(prev => prev.filter(t => t.name !== pendingDelete));
    setPendingDelete(null);
  };

  const handleAutoTag = async () => {
    setAutoTagging(true);
    setAutoTagResult(null);
    try {
      const result = await runAutoTag();
      setAutoTagResult(result);
      load();
    } finally {
      setAutoTagging(false);
    }
  };

  const visible = tags.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const manualCount = tags.filter(t => t.type === 'manual').length;
  const autoCount = tags.filter(t => t.type === 'auto').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Tags</h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
            {tags.length} total
          </span>
        </div>
        <button
          onClick={handleAutoTag}
          disabled={autoTagging}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <span>{autoTagging ? '⏳' : '⚙'}</span>
          {autoTagging ? 'Running…' : 'Run Auto-Tag'}
        </button>
      </div>

      {/* Auto-tag result banner */}
      {autoTagResult && (
        <div className="mb-4 p-4 bg-purple-900/20 border border-purple-700/40 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-purple-300">⚙ Auto-Tag Complete</span>
            <button onClick={() => setAutoTagResult(null)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mb-3">
            <div>
              <div className="text-xs text-[var(--text-secondary)]">Processed</div>
              <div className="font-bold">{autoTagResult.total_processed.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">Tagged</div>
              <div className="font-bold text-purple-300">{autoTagResult.transactions_with_auto_tags.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)]">Updated</div>
              <div className="font-bold text-green-400">{autoTagResult.transactions_updated.toLocaleString()}</div>
            </div>
          </div>
          {Object.keys(autoTagResult.tags_applied).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(autoTagResult.tags_applied as Record<string, number>).map(([tag, count]) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-700/60 text-white">
                  ⚙ {tag} <span className="opacity-70">×{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
          {(['all', 'manual', 'auto'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 transition-colors ${
                filter === f
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              {f === 'all' && `All (${tags.length})`}
              {f === 'manual' && `👤 Manual (${manualCount})`}
              {f === 'auto' && `⚙ Auto (${autoCount})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search tags..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg text-sm w-52"
        />
        <span className="text-xs text-[var(--text-secondary)] ml-auto">
          Showing {visible.length} of {tags.length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)] text-left">
              <th className="px-5 py-3">Tag</th>
              <th className="px-5 py-3">Colour</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Transactions</th>
              <th className="px-5 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--text-secondary)]">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-[var(--text-secondary)]">No tags found</td></tr>
            ) : visible.map(tag => (
              <tr key={tag.name} className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)] transition-colors">

                {/* Tag badge */}
                <td className="px-5 py-3">
                  <span className={tagCls(tag)} style={tagStyle(tag)}>
                    <span className="text-[10px] opacity-80">{tag.type === 'auto' ? '⚙' : '👤'}</span>
                    {tag.name}
                  </span>
                </td>

                {/* Colour picker cell */}
                <td className="px-5 py-3">
                  <div className="relative inline-block" ref={colorPickerTag === tag.name ? pickerRef : undefined}>
                    <button
                      onClick={() => setColorPickerTag(prev => prev === tag.name ? null : tag.name)}
                      title="Customise colour"
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors text-xs text-[var(--text-secondary)]"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                        style={{ background: tag.color || (tag.type === 'auto' ? '#7c3aed' : '#1d4ed8') }}
                      />
                      {tag.color ? 'Custom' : 'Default'}
                    </button>

                    {/* Colour popover */}
                    {colorPickerTag === tag.name && (
                      <div className="absolute left-0 top-full mt-1.5 z-50 p-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl w-52">
                        {/* Preset palette */}
                        <div className="grid grid-cols-6 gap-1.5 mb-3">
                          {PALETTE.map(c => (
                            <button
                              key={c}
                              onClick={() => handleColorChange(tag.name, c)}
                              style={{ background: c }}
                              className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                                tag.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-[var(--bg-card)]' : ''
                              }`}
                              title={c}
                            />
                          ))}
                        </div>

                        {/* Custom hex input */}
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="color"
                            defaultValue={tag.color || '#3B82F6'}
                            onChange={e => handleColorChange(tag.name, e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border border-[var(--border)] bg-transparent p-0.5"
                            title="Custom colour"
                          />
                          <span className="text-xs text-[var(--text-secondary)]">Custom colour</span>
                        </div>

                        {/* Set Default */}
                        <button
                          onClick={() => handleColorChange(tag.name, null)}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          Set Default
                        </button>
                      </div>
                    )}
                  </div>
                </td>

                {/* Type selector */}
                <td className="px-5 py-3">
                  <select
                    value={tag.type}
                    onChange={e => handleTypeChange(tag.name, e.target.value as 'manual' | 'auto')}
                    disabled={savingType === tag.name}
                    className="text-xs px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] disabled:opacity-50 cursor-pointer"
                  >
                    <option value="manual">👤 Manual</option>
                    <option value="auto">⚙ Auto-generated</option>
                  </select>
                </td>

                <td className="px-5 py-3 text-[var(--text-secondary)]">
                  {tag.count} {tag.count === 1 ? 'transaction' : 'transactions'}
                </td>

                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => setPendingDelete(tag.name)}
                    className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors px-2 py-1 rounded"
                    title="Remove tag from all transactions"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="Remove Tag"
        message={`Remove tag "${pendingDelete}" from all transactions? This cannot be undone.`}
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
