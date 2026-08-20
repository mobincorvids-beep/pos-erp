import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/format';

export function LoyaltyPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [program, setProgram] = useState(null);
  const [form, setForm] = useState({ earnRate: '', redemptionValue: '', minRedeemPoints: '', isActive: true });
  const [saving, setSaving] = useState(false);

  function load() {
    api.get('/loyalty/program').then((p) => {
      setProgram(p);
      if (p) setForm({ earnRate: p.earnRate, redemptionValue: p.redemptionValue, minRedeemPoints: p.minRedeemPoints, isActive: p.isActive });
    }).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/loyalty/program', {
        earnRate: Number(form.earnRate), redemptionValue: Number(form.redemptionValue),
        minRedeemPoints: Number(form.minRedeemPoints), isActive: form.isActive,
      });
      toast('Loyalty program saved.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="page-title mb-1">Loyalty program</p>
      <p className="text-sm text-ink-muted mb-6">Points are earned automatically on checkout. Redeeming points happens from a customer's ledger — see the Customers page.</p>

      <div className="grid grid-cols-2 gap-6">
        <form onSubmit={save} className="card p-4">
          <p className="text-sm font-medium mb-3">Program settings</p>
          <div className="space-y-3">
            <div>
              <label className="field-label">Points earned per currency unit spent</label>
              <input type="number" step="0.01" className="field-input num" value={form.earnRate} onChange={(e) => setForm({ ...form, earnRate: e.target.value })} disabled={!can('loyalty.manage')} placeholder="e.g. 100 = 1 point per 100 spent" />
            </div>
            <div>
              <label className="field-label">Redemption value per point</label>
              <input type="number" step="0.01" className="field-input num" value={form.redemptionValue} onChange={(e) => setForm({ ...form, redemptionValue: e.target.value })} disabled={!can('loyalty.manage')} />
            </div>
            <div>
              <label className="field-label">Minimum points to redeem</label>
              <input type="number" className="field-input num" value={form.minRedeemPoints} onChange={(e) => setForm({ ...form, minRedeemPoints: e.target.value })} disabled={!can('loyalty.manage')} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} disabled={!can('loyalty.manage')} />
              Program active
            </label>
          </div>
          {can('loyalty.manage') && (
            <button type="submit" disabled={saving} className="btn-primary w-full mt-4">{saving ? 'Saving…' : 'Save program'}</button>
          )}
        </form>

        <div className="card p-4">
          <p className="text-sm font-medium mb-2">How it works</p>
          <ul className="text-sm text-ink-muted space-y-2 list-disc pl-4">
            <li>Every completed sale with a customer attached earns points automatically after checkout — it never blocks or slows down the sale.</li>
            <li>A customer redeems points from their ledger panel (Customers page), which quotes a currency value and reserves the points.</li>
            <li>Since a sale only has per-line discounts (not one on the whole invoice), the redeemed value needs to be applied as a discount on the item lines at checkout.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
