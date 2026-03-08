import { useEffect, useState } from 'react';
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getRules, createRule, deleteRule, recategorize,
} from '../api';
import { Tag, Plus, Trash2, RefreshCw, Loader2, Pencil, Check, X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const PRESET_COLORS = [
  '#6B7280', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16',
];

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCatId, setNewCatId] = useState<number | ''>('');
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatResult, setRecatResult] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '#6B7280', icon: '' });

  // Delete state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add new category
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', color: '#3B82F6', icon: '' });
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
    getRules().then(setRules);
  }, []);

  // ── Category CRUD ──────────────────────────────────────────────

  const startEdit = (c: any) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, color: c.color || '#6B7280', icon: c.icon || '' });
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const updated = await updateCategory(editingId, editForm);
    setCategories(prev => prev.map(c => c.id === editingId ? updated : c));
    setEditingId(null);
  };

  const handleConfirmDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteCategory(deleteId);
      setCategories(prev => prev.filter(c => c.id !== deleteId));
      setDeleteId(null);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || 'Delete failed');
      setDeleteId(null);
    }
  };

  const handleAddCategory = async () => {
    if (!addForm.name.trim()) return;
    setAddLoading(true);
    try {
      const cat = await createCategory(addForm);
      setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      setAddForm({ name: '', color: '#3B82F6', icon: '' });
      setShowAdd(false);
    } finally {
      setAddLoading(false);
    }
  };

  // ── Rules ──────────────────────────────────────────────────────

  const handleAddRule = async () => {
    if (!newKeyword.trim() || !newCatId) return;
    const rule = await createRule({ keyword: newKeyword.trim(), category_id: Number(newCatId) });
    setRules(prev => [...prev, rule]);
    setNewKeyword('');
    setNewCatId('');
  };

  const handleDeleteRule = async (id: number) => {
    await deleteRule(id);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleRecategorize = async () => {
    setRecatLoading(true);
    setRecatResult(null);
    try {
      const res = await recategorize();
      setRecatResult(`Done — ${res.updated} transactions recategorized`);
    } finally {
      setRecatLoading(false);
    }
  };

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* ── Categories List ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Categories</h2>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} /> New Category
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-[var(--bg-card)] border border-blue-500 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="Category name"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
              />
              <input
                type="text"
                placeholder="Icon 🏠"
                value={addForm.icon}
                onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))}
                className="w-20 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm text-center"
              />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="color"
                value={addForm.color}
                onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
                className="h-8 w-10 rounded cursor-pointer border border-[var(--border)]"
              />
              <div className="flex gap-1">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setAddForm(f => ({ ...f, color: c }))}
                    className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${addForm.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowAdd(false)}
                className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!addForm.name.trim() || addLoading}
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-medium"
              >
                {addLoading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {deleteError && (
          <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400 flex items-center justify-between gap-2">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)}><X size={14} /></button>
          </div>
        )}

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {categories.map(c => (
              <div key={c.id}>
                {editingId === c.id ? (
                  <div className="px-4 py-3 bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: editForm.color }} />
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="flex-1 px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Icon"
                        value={editForm.icon}
                        onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
                        className="w-16 px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded text-sm text-center"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="color"
                        value={editForm.color}
                        onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                        className="h-7 w-9 rounded cursor-pointer border border-[var(--border)]"
                      />
                      <div className="flex gap-1">
                        {PRESET_COLORS.map(col => (
                          <button
                            key={col}
                            onClick={() => setEditForm(f => ({ ...f, color: col }))}
                            className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${editForm.color === col ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 text-xs border border-[var(--border)] rounded flex items-center gap-1 hover:bg-[var(--bg-primary)]"
                      >
                        <X size={12} /> Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
                      >
                        <Check size={12} /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 group">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    {c.icon && <span className="text-base">{c.icon}</span>}
                    <span className="text-sm flex-1">{c.name}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1 rounded hover:text-blue-400 text-[var(--text-secondary)] transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="p-1 rounded hover:text-red-400 text-[var(--text-secondary)] transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Rules ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Categorization Rules</h2>
          <button
            onClick={handleRecategorize}
            disabled={recatLoading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {recatLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Recategorize All
          </button>
        </div>

        {recatResult && (
          <div className="mb-3 px-3 py-2 bg-green-900/30 border border-green-800 rounded-lg text-sm text-green-400">
            {recatResult}
          </div>
        )}

        {/* Add Rule */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 mb-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Plus size={14} /> Add Rule
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Keyword (e.g. SWIGGY)"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddRule()}
              className="flex-1 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm"
            />
            <select
              value={newCatId}
              onChange={e => setNewCatId(Number(e.target.value) || '')}
              className="px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm w-40"
            >
              <option value="">Category...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={handleAddRule}
              disabled={!newKeyword.trim() || !newCatId}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Rules List */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto divide-y divide-[var(--border)]">
            {rules.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--text-secondary)] text-sm">No rules defined</div>
            ) : (
              rules.map(r => {
                const cat = catMap[r.category_id];
                return (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Tag size={14} className="text-[var(--text-secondary)]" />
                      <code className="text-sm bg-[var(--bg-primary)] px-2 py-0.5 rounded">{r.keyword}</code>
                      <span className="text-[var(--text-secondary)] text-xs">→</span>
                      {cat && (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.icon && <span>{cat.icon}</span>}
                          {cat.name}
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleDeleteRule(r.id)} className="text-[var(--text-secondary)] hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={deleteId !== null}
        title="Delete Category"
        message="This category will be permanently deleted. Categories with assigned transactions cannot be deleted — re-categorize those transactions first."
        confirmLabel="Delete"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
