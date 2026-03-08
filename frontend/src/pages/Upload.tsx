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

  const loadFolders = () => {
    setLoading(true);
    getFolders().then(setFolders).finally(() => setLoading(false));
  };

  useEffect(() => { loadFolders(); }, []);

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
    </div>
  );
}
