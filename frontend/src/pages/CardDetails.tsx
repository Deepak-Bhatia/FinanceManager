import { useEffect, useState } from 'react';
import { getCardDetails } from '../api';
import { CreditCard, Shield, CheckCircle2, AlertCircle, Banknote } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CardDetails() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCardDetails().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-[var(--text-secondary)]">Loading…</p>;
  if (!data || data.cards.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">My Cards</h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center text-[var(--text-secondary)]">
          No credit cards found. Parse credit card statements first.
        </div>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">My Cards</h2>
        <span className="text-sm text-[var(--text-secondary)]">
          {s.total_cards} cards · {s.free_cards} free · {s.paid_cards} paid
        </span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon={CreditCard} label="Total Cards" value={s.total_cards.toString()} color="text-blue-400" />
        <SummaryCard icon={Shield} label="Free Cards" value={s.free_cards.toString()} color="text-green-400" />
        <SummaryCard icon={Banknote} label="Pending Annual Fees" value={fmt(s.total_annual_fees)} color="text-red-400" />
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.cards.map((card: any) => (
          <div key={card.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base">{card.name}</h3>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{card.bank} · {card.network}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  card.is_free ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {card.is_free ? 'Free' : fmt(card.annual_fee) + '/yr'}
                </span>
              </div>
            </div>

            {/* Details body */}
            <div className="px-5 py-4 space-y-4">
              {/* Cycle */}
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-[var(--text-secondary)] text-xs">Cycle Start</span>
                  <div className="font-medium">Day {card.cycle_start}</div>
                </div>
                <div className="text-[var(--text-secondary)]">→</div>
                <div>
                  <span className="text-[var(--text-secondary)] text-xs">Cycle End</span>
                  <div className="font-medium">Day {card.cycle_end}</div>
                </div>
              </div>

              {/* Fee waiver progress */}
              {!card.is_free && card.fee_waiver && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[var(--text-secondary)]">Fee Waiver Progress</span>
                    <span className="flex items-center gap-1">
                      {card.waiver_met
                        ? <><CheckCircle2 size={12} className="text-green-400" /> <span className="text-green-400">Waived!</span></>
                        : <><AlertCircle size={12} className="text-yellow-400" /> <span className="text-yellow-400">{fmt(card.yearly_spend)} / {fmt(card.fee_waiver_amount)}</span></>
                      }
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${card.waiver_met ? 'bg-green-400' : 'bg-yellow-400'}`}
                      style={{ width: `${card.waiver_progress ?? 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">{card.fee_waiver}</div>
                </div>
              )}

              {/* Spend stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[var(--text-secondary)] text-xs">Total Spend</div>
                  <div className="font-medium">{fmt(card.total_spend)}</div>
                </div>
                <div>
                  <div className="text-[var(--text-secondary)] text-xs">Transactions</div>
                  <div className="font-medium">{card.total_transactions}</div>
                </div>
              </div>

              {/* Monthly history */}
              {card.monthly_history.length > 0 && (
                <div>
                  <h4 className="text-xs text-[var(--text-secondary)] font-semibold mb-2">Monthly Spend</h4>
                  <div className="flex gap-2 flex-wrap">
                    {card.monthly_history.slice(0, 6).map((m: any) => (
                      <div
                        key={`${m.year}-${m.month}`}
                        className="bg-[var(--bg-secondary)] rounded-lg px-3 py-1.5 text-xs"
                      >
                        <span className="text-[var(--text-secondary)]">{MONTHS[m.month]} {m.year} </span>
                        <span className="font-medium">{fmt(m.total)}</span>
                        <span className="text-[var(--text-secondary)]"> ({m.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {card.notes && (
                <div className="text-xs text-[var(--text-secondary)] italic">{card.notes}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-[var(--bg-secondary)] ${color}`}><Icon size={20} /></div>
      <div>
        <div className="text-xs text-[var(--text-secondary)]">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}
