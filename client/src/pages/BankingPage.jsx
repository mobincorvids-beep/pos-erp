import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

export function BankingPage() {
  return (
    <div>
      <p className="page-title mb-4">Banking</p>
      <div className="grid grid-cols-2 gap-4">
        <TransferCard />
        <ReconciliationCard />
      </div>
    </div>
  );
}

function TransferCard() {
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
      toast('Transfer posted.', 'success');
      setAmount('');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <p className="text-sm font-medium mb-3">Transfer between accounts</p>
      <div className="space-y-2">
        <select required className="field-input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
          <option value="">From account…</option>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
        <select required className="field-input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
          <option value="">To account…</option>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
        <input type="number" step="0.01" required placeholder="Amount" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full mt-3">{busy ? 'Posting…' : 'Transfer'}</button>
    </form>
  );
}

function ReconciliationCard() {
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
      toast('Reconciliation completed.', 'success');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <p className="text-sm font-medium mb-3">Reconcile against a statement</p>
      <div className="space-y-2">
        <select required className="field-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Account…</option>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
        <input type="date" required className="field-input" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
        <input type="number" step="0.01" required placeholder="Statement balance" className="field-input num" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full mt-3">{busy ? 'Checking…' : 'Compare to book balance'}</button>

      {result && (
        <div className="tear-line mt-3 pt-3 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">Book balance</span><span className="num">{result.bookBalanceAtCompletion}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">Difference</span><span className={`num ${result.difference === 0 ? 'text-accent-strong' : 'text-warning'}`}>{result.difference}</span></div>
        </div>
      )}
    </form>
  );
}
