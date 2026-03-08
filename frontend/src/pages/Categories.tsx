import { useEffect, useState } from 'react';
import { getCategories, getRules, createRule, deleteRule, recategorize } from '../api';
import { Tag, Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';

export default function Categories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCatId, setNewCatId] = useState<number | ''>('');
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatResult, setRecatResult] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories);
    getRules().then(setRules);
  }, []);

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
      {/* Categories List */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Categories</h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="divide-y divide-[var(--border)]">
            {categories.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                {c.icon && <span className="text-base">{c.icon}</span>}
                <span className="text-sm">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rules */}
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
    </div>
  );
}
