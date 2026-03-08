import { useEffect, useState } from 'react';
import { getTags, patchTag, deleteTag } from '../api';
import ConfirmModal from '../components/ConfirmModal';

type Tag = { name: string; type: 'manual' | 'auto'; count: number };
type Filter = 'all' | 'manual' | 'auto';

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getTags().then(setTags).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleTypeChange = async (name: string, newType: 'manual' | 'auto') => {
    setSavingType(name);
    // Optimistic update
    setTags(prev => prev.map(t => t.name === name ? { ...t, type: newType } : t));
    try {
      await patchTag(name, { type: newType });
    } catch {
      load(); // revert on error
    } finally {
      setSavingType(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    await deleteTag(pendingDelete);
    setTags(prev => prev.filter(t => t.name !== pendingDelete));
    setPendingDelete(null);
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Tags</h2>
          <span className="text-sm px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
            {tags.length} total
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        {/* Type tabs */}
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

        {/* Search */}
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
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Transactions</th>
              <th className="px-5 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[var(--text-secondary)]">
                  Loading…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-[var(--text-secondary)]">
                  No tags found
                </td>
              </tr>
            ) : visible.map(tag => (
              <tr key={tag.name} className="border-b border-[var(--border)] hover:bg-[var(--bg-primary)] transition-colors">
                {/* Tag name chip */}
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                    ${tag.type === 'auto' ? 'bg-purple-700/80 text-white' : 'bg-blue-700 text-white'}`}>
                    <span className="text-[10px] opacity-80">{tag.type === 'auto' ? '⚙' : '👤'}</span>
                    {tag.name}
                  </span>
                </td>

                {/* Type toggle */}
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

                {/* Transaction count */}
                <td className="px-5 py-3">
                  <span className="text-[var(--text-secondary)]">
                    {tag.count} {tag.count === 1 ? 'transaction' : 'transactions'}
                  </span>
                </td>

                {/* Delete */}
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
