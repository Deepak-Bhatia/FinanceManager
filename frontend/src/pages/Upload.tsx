import { useEffect, useState } from 'react';
import { getFolders, parseFolder } from '../api';
import { FolderOpen, Play, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react';

interface FolderInfo { name: string; files: string[]; }
interface FileDetail { file: string; parsed: number; added: number; skipped: number; }
interface ParseResult {
  folder: string;
  files_processed: number;
  transactions_added: number;
  transactions_skipped: number;
  details: FileDetail[];
  errors: string[];
}

export default function Upload() {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ParseResult>>({});
  const [backups, setBackups] = useState<string[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [cleanSuccess, setCleanSuccess] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Record<string, boolean>>({
    transactions: true,
    emi: false,
    audit_logs: false,
    categories: false,
  });

  const loadFolders = () => {
    setLoading(true);
    getFolders().then(setFolders).finally(() => setLoading(false));
  };

  useEffect(() => { loadFolders(); }, []);

  useEffect(() => { loadBackups(); }, []);

  const loadBackups = async () => {
    setBackupLoading(true);
    try {
      const b = await (await import('../api')).listBackups();
      setBackups(b);
    } catch (e) {
      setBackups([]);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleParse = async (folderName: string) => {
    setParsing(folderName);
    try {
      const res = await parseFolder(folderName);
      setResults(prev => ({ ...prev, [folderName]: res }));
    } catch (err: any) {
      setResults(prev => ({
        ...prev,
        [folderName]: {
          folder: folderName,
          files_processed: 0,
          transactions_added: 0,
          transactions_skipped: 0,
          details: [],
          errors: [err?.response?.data?.detail || 'Parse failed'],
        },
      }));
    } finally {
      setParsing(null);
    }
  };

  const totalAdded = (r: ParseResult) => r.transactions_added;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Database Backup & Restore</h3>
          <p className="text-xs text-[var(--text-secondary)]">Create a snapshot before cleaning data; restore from available backups.</p>
        </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowCleanModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                disabled={cleanLoading}
              >
                {cleanLoading ? 'Cleaning…' : 'Clean Data (backup first)'}
              </button>
              {cleanLoading && (
                <div className="absolute left-0 right-0 -bottom-3">
                  <div className="h-1 bg-red-200 rounded overflow-hidden">
                    <div className="h-full bg-red-500 animate-pulse" style={{width: '100%'}} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                onChange={e => {
                  const val = e.target.value;
                  if (!val) return;
                  const ok = window.confirm(`Restore backup ${val}? This will overwrite current database. Proceed?`);
                  if (!ok) return;
                  setRestoreSuccess(null);
                  setRestoreLoading(true);
                  (async () => {
                    try {
                      await (await import('../api')).restoreBackup(val);
                      loadFolders();
                      setRestoreSuccess(`Restored ${val}`);
                      setTimeout(() => setRestoreSuccess(null), 8000);
                    } catch (e) {
                      setRestoreSuccess('Restore failed');
                      setTimeout(() => setRestoreSuccess(null), 4000);
                    } finally {
                      setRestoreLoading(false);
                      loadBackups();
                    }
                  })();
                }}
                className="px-2 py-1 border rounded bg-[var(--bg-primary)] text-sm"
                disabled={restoreLoading}
              >
                <option value="">Restore from backup</option>
                {backups.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              {restoreLoading && (
                <div className="ml-2 text-sm text-[var(--text-secondary)]">Restoring…</div>
              )}
            </div>
          </div>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Import Statements</h2>
        <button onClick={loadFolders} className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--border)] transition-colors">
          Refresh Folders
        </button>
      </div>

      <p className="text-[var(--text-secondary)] text-sm mb-6">
        Place your bank statements (PDFs, Excel, CSV) into monthly folders inside the <code className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded">input/</code> directory
        (e.g., <code className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded">input/2026-02/</code>), then click Parse to ingest them.
      </p>

      {loading ? (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <Loader2 size={24} className="animate-spin mx-auto mb-2" />
          Scanning folders...
        </div>
      ) : folders.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
          <FolderOpen size={40} className="mx-auto mb-3 text-[var(--text-secondary)]" />
          <p className="text-[var(--text-secondary)]">No folders found in the input directory.</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Create a folder like <code>input/2026-02/</code> and add your statement files.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {folders.map(f => {
            const result = results[f.name];
            const isParsing = parsing === f.name;
            return (
              <div key={f.name} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <FolderOpen size={20} className="text-blue-400" />
                    <div>
                      <h3 className="font-semibold">{f.name}</h3>
                      <p className="text-xs text-[var(--text-secondary)]">{f.files.length} file{f.files.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleParse(f.name)}
                    disabled={isParsing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {isParsing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    {isParsing ? 'Parsing...' : 'Parse'}
                  </button>
                </div>

                {/* File list */}
                <div className="px-5 pb-3 flex flex-wrap gap-2">
                  {f.files.map(file => (
                    <span key={file} className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-primary)] rounded text-xs text-[var(--text-secondary)]">
                      <FileText size={12} /> {file}
                    </span>
                  ))}
                </div>

                {/* Parse results */}
                {result && (
                  <div className="border-t border-[var(--border)] px-5 py-3">
                    {result.errors.length > 0 && (
                      <div className="flex items-center gap-2 mb-2 text-red-400">
                        <XCircle size={16} />
                        <span className="text-sm">{result.errors.join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={16} className="text-green-400" />
                      <span className="text-sm font-medium">
                        {totalAdded(result)} added, {result.transactions_skipped} skipped
                      </span>
                    </div>
                    <div className="space-y-1">
                      {result.details.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <CheckCircle size={12} className="text-green-400 shrink-0" />
                          <span className="text-[var(--text-secondary)]">{d.file}</span>
                          <span className="text-[var(--text-secondary)]">—</span>
                          <span>{d.added} added, {d.skipped} skipped</span>
                          <span className="text-[var(--text-secondary)]">(parsed {d.parsed})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        {/* Success messages */}
        {cleanSuccess && (
          <div className="fixed right-6 bottom-6 bg-green-600 text-white px-4 py-2 rounded shadow">
            {cleanSuccess}
          </div>
        )}
        {restoreSuccess && (
          <div className="fixed right-6 bottom-20 bg-blue-600 text-white px-4 py-2 rounded shadow">
            {restoreSuccess}
          </div>
        )}
        {/* Clean modal */}
        {showCleanModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[520px] shadow-xl">
              <h3 className="text-lg font-semibold mb-2 text-gray-900">Select entities to clean</h3>
              <p className="text-sm text-gray-600 mb-4">A backup will be created before deleting. Select which entities to remove.</p>
              <div className="grid gap-3 mb-4">
                <label className="flex items-center gap-3">
                  <input style={{accentColor: '#dc2626'}} className="h-5 w-5" type="checkbox" checked={selectedEntities.transactions} onChange={e => setSelectedEntities(prev => ({...prev, transactions: e.target.checked}))} />
                  <span className="text-sm text-gray-800">Transactions</span>
                </label>
                <label className="flex items-center gap-3">
                  <input style={{accentColor: '#dc2626'}} className="h-5 w-5" type="checkbox" checked={selectedEntities.emi} onChange={e => setSelectedEntities(prev => ({...prev, emi: e.target.checked}))} />
                  <span className="text-sm text-gray-800">EMI (emi_details)</span>
                </label>
                <label className="flex items-center gap-3">
                  <input style={{accentColor: '#dc2626'}} className="h-5 w-5" type="checkbox" checked={selectedEntities.audit_logs} onChange={e => setSelectedEntities(prev => ({...prev, audit_logs: e.target.checked}))} />
                  <span className="text-sm text-gray-800">Audit Log</span>
                </label>
                <label className="flex items-center gap-3">
                  <input style={{accentColor: '#dc2626'}} className="h-5 w-5" type="checkbox" checked={selectedEntities.categories} onChange={e => setSelectedEntities(prev => ({...prev, categories: e.target.checked}))} />
                  <span className="text-sm text-gray-800">Categories</span>
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50" onClick={() => setShowCleanModal(false)}>Cancel</button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  onClick={async () => {
                    // build entities array
                    const entities = Object.entries(selectedEntities).filter(([k,v]) => v).map(([k]) => k);
                    if (entities.length === 0) {
                      alert('Select at least one entity to delete');
                      return;
                    }
                    setShowCleanModal(false);
                    setCleanSuccess(null);
                    setCleanLoading(true);
                    try {
                      const res = await (await import('../api')).cleanData(entities);
                      await loadBackups();
                      loadFolders();
                      if (res && res.backed_up) {
                        setCleanSuccess(`Clean successful — backup: ${res.backed_up}`);
                        setTimeout(() => setCleanSuccess(null), 8000);
                      } else {
                        setCleanSuccess('Clean completed');
                        setTimeout(() => setCleanSuccess(null), 4000);
                      }
                    } catch (err) {
                      setCleanSuccess('Clean failed');
                      setTimeout(() => setCleanSuccess(null), 4000);
                    } finally {
                      setCleanLoading(false);
                    }
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
