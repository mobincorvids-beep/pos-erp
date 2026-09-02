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
      <div className="mt-5">
        <StatementImportCard />
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

const LINE_STATUS_CHIP = {
  matched: 'chip-accent',
  unmatched: 'chip-warning',
  no_match: 'chip-danger',
};

/**
 * Import a bank statement CSV, auto-match its lines against unreconciled
 * voucher entries on the chosen account, and work through whatever's left:
 * link a line to a specific voucher by hand, or flag it as having no
 * matching transaction (e.g. a bank fee not yet recorded).
 *
 * Flow: start a reconciliation (account + statement date/balance) -> paste
 * or upload the CSV -> preview the parsed rows -> import (this also runs
 * auto-matching) -> review/resolve what's left.
 */
function StatementImportCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [statementBalance, setStatementBalance] = useState('');
  const [reconciliationId, setReconciliationId] = useState(null);
  const [starting, setStarting] = useState(false);

  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null); // { lines, errors }
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const [summary, setSummary] = useState(null); // reconciliationSummary()
  const [candidateVouchers, setCandidateVouchers] = useState([]);

  useEffect(() => { api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, []);

  async function startReconciliation(e) {
    e.preventDefault();
    setStarting(true);
    try {
      const rec = await api.post('/banking/reconciliations', { accountId, statementDate, statementBalance: Number(statementBalance) });
      setReconciliationId(rec._id);
      setSummary(null);
      setPreview(null);
      toast(t('banking.statementImport.started'), 'success');
    } catch (err) { toast(err.message, 'error'); } finally { setStarting(false); }
  }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ''));
    reader.readAsText(file);
  }

  async function previewCsv() {
    if (!csvText.trim()) return;
    setParsing(true);
    try {
      const result = await api.post('/banking/statement/parse', { csv: csvText });
      setPreview(result);
      if (result.errors.length > 0) {
        toast(t('banking.statementImport.previewErrors', { count: result.errors.length }), 'error');
      }
    } catch (err) { toast(err.message, 'error'); } finally { setParsing(false); }
  }

  async function refreshSummary(id) {
    const [s, detail] = await Promise.all([
      api.get(`/banking/reconciliations/${id}/summary`),
      api.get(`/banking/reconciliations/${id}`),
    ]);
    setSummary(s);
    setCandidateVouchers(detail.vouchers || []);
  }

  async function importStatement() {
    if (!preview?.lines?.length) return;
    setImporting(true);
    try {
      await api.post(`/banking/reconciliations/${reconciliationId}/import-statement`, { lines: preview.lines });
      await refreshSummary(reconciliationId);
      toast(t('banking.statementImport.imported'), 'success');
    } catch (err) { toast(err.message, 'error'); } finally { setImporting(false); }
  }

  async function linkLine(lineId, voucherId) {
    if (!voucherId) return;
    try {
      await api.patch(`/banking/reconciliations/${reconciliationId}/lines/${lineId}/match`, { voucherId });
      await refreshSummary(reconciliationId);
    } catch (err) { toast(err.message, 'error'); }
  }

  async function noMatchLine(lineId) {
    try {
      await api.patch(`/banking/reconciliations/${reconciliationId}/lines/${lineId}/no-match`, {});
      await refreshSummary(reconciliationId);
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-display text-base font-bold text-ink">{t('banking.statementImport.title')}</p>
          <p className="text-xs text-ink-muted mt-0.5">{t('banking.statementImport.subtitle')}</p>
        </div>
        <span className="material-symbols-outlined text-ink-muted text-[20px]">receipt_long</span>
      </div>

      {!reconciliationId ? (
        <form onSubmit={startReconciliation} className="grid grid-cols-3 gap-3 items-end">
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
          <div className="col-span-3">
            <button type="submit" disabled={starting} className="btn-primary">
              {starting ? t('banking.statementImport.starting') : t('banking.statementImport.startButton')}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {!summary && (
            <>
              <div>
                <p className="text-xs text-ink-muted mb-2">{t('banking.statementImport.csvHint')}</p>
                <div className="flex items-center gap-3 mb-2">
                  <input type="file" accept=".csv,text/csv" onChange={onFileChosen} className="text-sm" />
                  <span className="text-xs text-ink-muted">{t('banking.statementImport.orPaste')}</span>
                </div>
                <textarea
                  className="field-input font-mono text-xs w-full"
                  rows={5}
                  placeholder={'Date,Description,Amount\n2026-08-01,Monthly service fee,-25.00\n2026-08-03,Customer payment - INV1042,1500.00'}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" disabled={!csvText.trim() || parsing} onClick={previewCsv}>
                  {parsing ? t('banking.statementImport.parsing') : t('banking.statementImport.previewButton')}
                </button>
                {preview?.lines?.length > 0 && (
                  <button type="button" className="btn-primary" disabled={importing} onClick={importStatement}>
                    {importing ? t('banking.statementImport.importing') : t('banking.statementImport.importButton', { count: preview.lines.length })}
                  </button>
                )}
              </div>

              {preview && (
                <div className="border border-rule rounded-lg overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-sunken text-left">
                          <th className="px-3 py-1.5 font-semibold text-ink-muted">{t('banking.statementImport.colDate')}</th>
                          <th className="px-3 py-1.5 font-semibold text-ink-muted">{t('banking.statementImport.colDescription')}</th>
                          <th className="px-3 py-1.5 font-semibold text-ink-muted text-right">{t('banking.statementImport.colAmount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.lines.map((l, i) => (
                          <tr key={i} className="border-t border-rule">
                            <td className="px-3 py-1.5">{new Date(l.date).toLocaleDateString()}</td>
                            <td className="px-3 py-1.5">{l.description}</td>
                            <td className={`px-3 py-1.5 num text-right ${l.amount < 0 ? 'text-danger' : 'text-ink'}`}>{l.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.errors.length > 0 && (
                    <div className="border-t border-rule px-3 py-2 text-xs text-danger">
                      {preview.errors.map((e, i) => <div key={i}>{t('banking.statementImport.rowError', { row: e.row, error: e.error })}</div>)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3 text-sm">
                <SummaryStat label={t('banking.statementImport.statementTotal')} value={summary.statementTotal} />
                <SummaryStat label={t('banking.statementImport.matchedTotal')} value={summary.matchedTotal} />
                <SummaryStat label={t('banking.statementImport.needsReview')} value={summary.unmatchedCount} plain />
                <SummaryStat label={t('banking.difference')} value={summary.difference} highlight={summary.difference !== 0} />
              </div>

              <div className="border border-rule rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-sunken text-left">
                      <th className="px-3 py-1.5 font-semibold text-ink-muted">{t('banking.statementImport.colDate')}</th>
                      <th className="px-3 py-1.5 font-semibold text-ink-muted">{t('banking.statementImport.colDescription')}</th>
                      <th className="px-3 py-1.5 font-semibold text-ink-muted text-right">{t('banking.statementImport.colAmount')}</th>
                      <th className="px-3 py-1.5 font-semibold text-ink-muted">{t('banking.statementImport.colStatus')}</th>
                      <th className="px-3 py-1.5 font-semibold text-ink-muted">{t('banking.statementImport.colAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.lines.map((l) => (
                      <tr key={l._id} className="border-t border-rule align-top">
                        <td className="px-3 py-1.5">{new Date(l.date).toLocaleDateString()}</td>
                        <td className="px-3 py-1.5">{l.description}</td>
                        <td className={`px-3 py-1.5 num text-right ${l.amount < 0 ? 'text-danger' : 'text-ink'}`}>{l.amount.toFixed(2)}</td>
                        <td className="px-3 py-1.5">
                          <span className={LINE_STATUS_CHIP[l.status]}>
                            {l.status === 'matched'
                              ? (l.matchConfidence === 'auto' ? t('banking.statementImport.statusAutoMatched') : t('banking.statementImport.statusManualMatched'))
                              : l.status === 'no_match' ? t('banking.statementImport.statusNoMatch') : t('banking.statementImport.statusUnmatched')}
                          </span>
                          {l.matchedVoucher?.voucherNumber && (
                            <div className="text-ink-muted mt-0.5">{l.matchedVoucher.voucherNumber}</div>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {l.status === 'unmatched' && (
                            <div className="flex items-center gap-1.5">
                              <select
                                className="field-input !py-1 !text-xs"
                                defaultValue=""
                                onChange={(e) => linkLine(l._id, e.target.value)}
                              >
                                <option value="">{t('banking.statementImport.linkToVoucher')}</option>
                                {candidateVouchers.map((v) => (
                                  <option key={v.voucherId} value={v.voucherId}>
                                    {v.voucherNumber} — {new Date(v.date).toLocaleDateString()}
                                  </option>
                                ))}
                              </select>
                              <button type="button" className="btn-ghost !text-xs !px-2" onClick={() => noMatchLine(l._id)}>
                                {t('banking.statementImport.noMatch')}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, highlight, plain }) {
  return (
    <div className="border border-rule rounded-lg px-3 py-2">
      <p className="text-xs text-ink-muted mb-0.5">{label}</p>
      <p className={`num font-semibold ${highlight ? 'text-danger' : 'text-ink'}`}>{plain ? value : Number(value).toFixed(2)}</p>
    </div>
  );
}
