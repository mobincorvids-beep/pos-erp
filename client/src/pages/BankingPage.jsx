import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

export function BankingPage() {
  const { t } = useTranslation();
  return (
    <div>
      <p className="eyebrow mb-1">Finance</p>
      <p className="page-title mb-6">{t('banking.title')}</p>
      <div className="grid grid-cols-2 gap-5">
        <TransferCard />
        <ReconciliationCard />
      </div>
    </div>
  );
}

function TransferCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/banking/transfers', { fromAccountId, toAccountId, amount: Number(amount) });
      toast(t('banking.transferPosted'), 'success');
      setAmount('');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-base font-bold text-ink">{t('banking.transferBetweenAccounts')}</p>
        <span className="material-symbols-outlined text-ink-muted text-[20px]">sync_alt</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className="field-label">{t('banking.fromAccount')}</label>
          <select required className="field-input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
            <option value="">{t('banking.selectAccount')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">{t('banking.toAccount')}</label>
          <select required className="field-input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">{t('banking.selectAccount')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">{t('banking.amount')}</label>
          <input type="number" step="0.01" required placeholder="0.00" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full mt-4">{busy ? t('banking.posting') : t('banking.transfer')}</button>
    </form>
  );
}

function ReconciliationCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const rec = await api.post('/banking/reconciliations', { accountId, statementDate, statementBalance: Number(statementBalance) });
      const completed = await api.post(`/banking/reconciliations/${rec._id}/complete`);
      setResult(completed);
      toast(t('banking.reconciliationCompleted'), 'success');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-base font-bold text-ink">{t('banking.reconcileAgainstStatement')}</p>
        <span className="material-symbols-outlined text-ink-muted text-[20px]">fact_check</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className="field-label">{t('banking.account')}</label>
          <select required className="field-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{t('banking.selectAccount')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">{t('banking.statementDate')}</label>
          <input type="date" required className="field-input" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
        </div>
        <div>
          <label className="field-label">{t('banking.statementBalance')}</label>
          <input type="number" step="0.01" required placeholder="0.00" className="field-input num" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full mt-4">{busy ? t('banking.checking') : t('banking.compareToBookBalance')}</button>

      {result && (
        <div className="tear-line mt-4 pt-4 text-sm space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">{t('banking.bookBalance')}</span>
            <span className="num font-semibold text-ink">{result.bookBalanceAtCompletion}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">{t('banking.difference')}</span>
            <span className={result.difference === 0 ? 'chip-accent' : 'chip-warning'}>
              <span className="num">{result.difference}</span>
            </span>
          </div>
        </div>
      )}
    </form>
  );
}
