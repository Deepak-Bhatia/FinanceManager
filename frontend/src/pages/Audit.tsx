import { useEffect, useState } from 'react';
import { getAuditLogs } from '../api';
import { FileText, Tag, RefreshCw, Trash2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const EVENT_ICONS: Record<string, any> = {
  parse: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Parse' },
  category_change: { icon: Tag, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Category' },
  type_change: { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Type' },
  field_change: { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Edit' },
  delete: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-50', label: 'Delete' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function Audit() {
  const [data, setData] = useState<any>({ items: [], total: 0, per_page: 50 });
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    getAuditLogs({ event_type: filter || undefined, page, per_page: 50 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, filter]);

  const totalPages = Math.ceil(data.total / data.per_page);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <div className="flex gap-2 items-center">
          <Filter size={16} className="text-[var(--text-secondary)]" />
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(1); }}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Events</option>
            <option value="parse">Parse</option>
            <option value="category_change">Category Changes</option>
            <option value="type_change">Type Changes</option>
            <option value="field_change">Field Changes</option>
          </select>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-[var(--text-secondary)]">Loading...</div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-12 text-center text-[var(--text-secondary)]">No audit events found</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {data.items.map((log: any) => {
              const ev = EVENT_ICONS[log.event_type] || EVENT_ICONS.field_change;
              const Icon = ev.icon;
              const isExpanded = expandedId === log.id;
              let details: any = null;
              if (log.details) {
                try { details = JSON.parse(log.details); } catch { details = null; }
              }

              return (
                <div
                  key={log.id}
                  className="px-5 py-4 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${ev.bg} flex items-center justify-center`}>
                      <Icon size={16} className={ev.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${ev.bg} ${ev.color}`}>
                          {ev.label}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)]">{log.summary}</p>

                      {isExpanded && details && (
                        <div className="mt-3 p-3 bg-[var(--bg-secondary)] rounded-lg text-xs">
                          {log.event_type === 'parse' && details.file_details ? (
                            <div>
                              <div className="grid grid-cols-4 gap-3 mb-3">
                                <div className="text-center">
                                  <div className="text-lg font-bold text-[var(--accent)]">{details.files_processed}</div>
                                  <div className="text-[var(--text-secondary)]">Files Processed</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-green-600">{details.transactions_added}</div>
                                  <div className="text-[var(--text-secondary)]">Added</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-amber-600">{details.transactions_skipped}</div>
                                  <div className="text-[var(--text-secondary)]">Duplicates</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-red-600">{details.errors?.length || 0}</div>
                                  <div className="text-[var(--text-secondary)]">Errors</div>
                                </div>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                                    <th className="text-left py-1.5 pr-3">File</th>
                                    <th className="text-right py-1.5 px-2">Parsed</th>
                                    <th className="text-right py-1.5 px-2">Added</th>
                                    <th className="text-right py-1.5 px-2">Skipped</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {details.file_details.map((f: any, i: number) => (
                                    <tr key={i} className="border-b border-[var(--border)] last:border-0">
                                      <td className="py-1.5 pr-3">{f.file}</td>
                                      <td className="text-right py-1.5 px-2">{f.parsed}</td>
                                      <td className="text-right py-1.5 px-2 text-green-600">{f.added}</td>
                                      <td className="text-right py-1.5 px-2 text-amber-600">{f.skipped}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {details.field && (
                                <div>
                                  <span className="text-[var(--text-secondary)]">Field: </span>
                                  <span className="font-medium">{details.field}</span>
                                </div>
                              )}
                              {details.old !== undefined && (
                                <div>
                                  <span className="text-[var(--text-secondary)]">From: </span>
                                  <span className="line-through text-red-600">{details.old}</span>
                                </div>
                              )}
                              {details.new !== undefined && (
                                <div>
                                  <span className="text-[var(--text-secondary)]">To: </span>
                                  <span className="font-medium text-green-600">{details.new}</span>
                                </div>
                              )}
                              {details.transaction_id && (
                                <div>
                                  <span className="text-[var(--text-secondary)]">Transaction ID: </span>
                                  <span>#{details.transaction_id}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-secondary)]">
              Showing {(page - 1) * data.per_page + 1}-{Math.min(page * data.per_page, data.total)} of {data.total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1 rounded hover:bg-[var(--border)] disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
