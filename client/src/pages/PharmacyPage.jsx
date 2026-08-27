import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

export function PharmacyPage() {
  const [tab, setTab] = useState('prescriptions');
  return (
    <div>
      <header className="mb-6 flex flex-wrap justify-between items-end gap-3">
        <div>
          <p className="page-title mb-1">Pharmacy</p>
          <p className="text-sm text-ink-muted">Prescriptions, patients, prescribers, and expiry tracking.</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-2 mb-6">
        {[['prescriptions', 'Prescriptions'], ['patients', 'Patients'], ['doctors', 'Doctors'], ['expiry', 'Near-expiry']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'prescriptions' && <PrescriptionsTab />}
      {tab === 'patients' && <PatientsTab />}
      {tab === 'doctors' && <DoctorsTab />}
      {tab === 'expiry' && <NearExpiryTab />}
    </div>
  );
}

function DoctorsTab() {
  const toast = useToast();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit

  function load() {
    setLoading(true);
    api.get('/pharmacy/doctors').then(setDoctors).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleRemove(d) {
    if (!window.confirm(`Remove Dr. ${d.name}? Past prescriptions keep referencing them.`)) return;
    try {
      await api.del(`/pharmacy/doctors/${d._id}`);
      toast('Doctor removed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-4"><button className="btn-primary" onClick={() => setEditing({})}>Add doctor</button></div>
      {loading && <Loading />}
      {!loading && doctors.length === 0 && <EmptyState title="No doctors yet" description="Register the doctors whose prescriptions you fill." action={<button className="btn-primary" onClick={() => setEditing({})}>Add one</button>} />}
      {!loading && doctors.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
            <p className="font-display text-base font-semibold text-ink">Doctors</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-rule text-left eyebrow"><th className="px-5 py-3 font-semibold">Name</th><th className="px-5 py-3 font-semibold">Specialization</th><th className="px-5 py-3 font-semibold">Reg. #</th><th className="px-5 py-3 font-semibold">Phone</th><th className="px-5 py-3 font-semibold text-right">Actions</th></tr></thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60 transition-colors">
                    <td className="px-5 py-3 font-medium text-ink">Dr. {d.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{d.specialization || '—'}</td>
                    <td className="px-5 py-3 text-ink-muted num">{d.registrationNumber || '—'}</td>
                    <td className="px-5 py-3 text-ink-muted">{d.phone || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing(d)}>Edit</button>
                      <button className="btn-ghost !text-danger !px-2 text-xs" onClick={() => handleRemove(d)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing !== null && <DoctorForm doctor={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function DoctorForm({ doctor, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !doctor._id;
  const [form, setForm] = useState({ name: doctor.name || '', specialization: doctor.specialization || '', registrationNumber: doctor.registrationNumber || '', phone: doctor.phone || '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/pharmacy/doctors', form);
        toast('Doctor added.', 'success');
      } else {
        await api.put(`/pharmacy/doctors/${doctor._id}`, form);
        toast('Doctor updated.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{isNew ? 'Add doctor' : 'Edit doctor'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Specialization</label><input className="field-input" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Cardiology" /></div>
          <div><label className="field-label">Registration number</label><input className="field-input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} placeholder="PMDC number" /></div>
          <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function PatientsTab() {
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit

  function load() {
    setLoading(true);
    api.get('/pharmacy/patients').then(setPatients).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setEditing({})}>Add patient</button></div>
      {loading && <Loading />}
      {!loading && patients.length === 0 && <EmptyState title="No patients yet" action={<button className="btn-primary" onClick={() => setEditing({})}>Add one</button>} />}
      {!loading && patients.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Age</th><th className="px-3 py-2 font-medium">Phone</th><th className="px-3 py-2 font-medium">Allergies</th><th className="px-3 py-2 font-medium text-right">Actions</th></tr></thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{p.age || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{p.phone || '—'}</td>
                  <td className="px-3 py-2">{p.allergies?.map((a) => <span key={a} className="chip-danger mr-1">{a}</span>)}</td>
                  <td className="px-3 py-2 text-right"><button className="btn-ghost !text-ink-muted !px-2 text-xs" onClick={() => setEditing(p)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== null && <PatientForm patient={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function PatientForm({ patient, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !patient._id;
  const [form, setForm] = useState({
    name: patient.name || '', age: patient.age || '', gender: patient.gender || '',
    phone: patient.phone || '', allergies: (patient.allergies || []).join(', '),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, age: Number(form.age) || undefined, allergies: form.allergies ? form.allergies.split(',').map((a) => a.trim()).filter(Boolean) : [] };
      if (isNew) {
        await api.post('/pharmacy/patients', payload);
        toast('Patient added.', 'success');
      } else {
        await api.put(`/pharmacy/patients/${patient._id}`, payload);
        toast('Patient updated.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{isNew ? 'Add patient' : 'Edit patient'}</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Age</label><input type="number" className="field-input num" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
            <div>
              <label className="field-label">Gender</label>
              <select className="field-input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
              </select>
            </div>
          </div>
          <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="field-label">Allergies (comma-separated)</label><input className="field-input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function PrescriptionsTab() {
  const toast = useToast();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [dispensing, setDispensing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/pharmacy/prescriptions').then(setPrescriptions).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleCancel(p) {
    if (!window.confirm('Cancel this prescription? It has not been dispensed yet.')) return;
    try {
      await api.del(`/pharmacy/prescriptions/${p._id}`);
      toast('Prescription cancelled.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setShowForm(true)}>New prescription</button></div>
      {loading && <Loading />}
      {!loading && prescriptions.length === 0 && <EmptyState title="No prescriptions yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create one</button>} />}
      {!loading && prescriptions.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Items</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium"></th></tr></thead>
            <tbody>
              {prescriptions.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{p.items.map((i) => i.medicineName).join(', ')}</td>
                  <td className="px-3 py-2"><span className={p.status === 'dispensed' ? 'chip-accent' : 'chip-neutral'}>{p.status.replace('_', ' ')}</span></td>
                  <td className="px-3 py-2 text-right">
                    {p.status !== 'dispensed' && <button className="btn-ghost !text-accent !px-2 text-xs" onClick={() => setDispensing(p)}>Dispense</button>}
                    {p.status === 'pending' && <button className="btn-ghost !text-danger !px-2 text-xs" onClick={() => handleCancel(p)}>Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <PrescriptionForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {dispensing && <DispenseForm prescription={dispensing} onClose={() => setDispensing(null)} onDispensed={() => { setDispensing(null); load(); }} />}
    </div>
  );
}

function PrescriptionForm({ onClose, onSaved }) {
  const toast = useToast();
  const [patients, setPatients] = useState([]);
  const [products, setProducts] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState([{ productId: '', medicineName: '', dosage: '', frequency: '', durationDays: '', quantityPrescribed: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/pharmacy/patients').then(setPatients).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  function updateItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const resolvedItems = items.filter((it) => it.productId).map((it) => {
        const product = products.find((p) => p._id === it.productId);
        return { ...it, variantId: product?.variants[0]?._id, medicineName: it.medicineName || product?.name, quantityPrescribed: Number(it.quantityPrescribed), durationDays: Number(it.durationDays) || undefined };
      });
      if (resolvedItems.length === 0) throw new Error('Add at least one item.');
      await api.post('/pharmacy/prescriptions', { patientId, items: resolvedItems });
      toast('Prescription created.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">New prescription</p>
        <div className="mb-4">
          <label className="field-label">Patient</label>
          <select required className="field-input" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Select…</option>
            {patients.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <p className="field-label mb-1">Items</p>
        <div className="space-y-3 mb-2">
          {items.map((it, i) => (
            <div key={i} className="border border-rule rounded p-2 space-y-2">
              <select className="field-input" value={it.productId} onChange={(e) => updateItem(i, { productId: e.target.value })}>
                <option value="">Medicine (product)…</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Dosage" className="field-input" value={it.dosage} onChange={(e) => updateItem(i, { dosage: e.target.value })} />
                <input placeholder="Frequency" className="field-input" value={it.frequency} onChange={(e) => updateItem(i, { frequency: e.target.value })} />
                <input type="number" placeholder="Qty" className="field-input num" value={it.quantityPrescribed} onChange={(e) => updateItem(i, { quantityPrescribed: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setItems([...items, { productId: '', medicineName: '', dosage: '', frequency: '', durationDays: '', quantityPrescribed: 1 }])}>+ Add item</button>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function DispenseForm({ prescription, onClose, onDispensed }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', warehouseId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const items = prescription.items.map((it) => {
        const product = products.find((p) => p._id === String(it.productId));
        return { productId: it.productId, variantId: it.variantId, quantity: it.quantityPrescribed, unitPrice: product?.sellingPrice ?? 0 };
      });
      // No customerId passed — Prescription only links to a Patient, not a
      // Customer, and the list response here isn't populated with enough
      // to resolve one even if Patient.customerId is sometimes set. This
      // dispenses as a walk-in sale; linking it to a billing account is a
      // real gap, not an oversight — flagged here rather than faked.
      await api.post(`/pharmacy/prescriptions/${prescription._id}/dispense`, {
        ...form, items,
        payments: [{ paymentAccountId: form.paymentAccountId, method: 'cash', amount: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) }],
      });
      toast('Dispensed and billed.', 'success');
      onDispensed();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Dispense prescription</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Payment account</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-3">Dispenses the full prescribed quantity for every item — partial dispensing isn't supported yet.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Dispensing…' : 'Dispense & bill'}</button>
        </div>
      </form>
    </div>
  );
}

function NearExpiryTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get(`/pharmacy/reports/near-expiry?days=${days}`).then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [days]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <label className="text-sm text-ink-muted">Within</label>
        <input type="number" className="field-input !w-20 num" value={days} onChange={(e) => setDays(e.target.value)} />
        <label className="text-sm text-ink-muted">days</label>
      </div>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <EmptyState title="Nothing expiring soon" />}
      {!loading && rows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Product</th><th className="px-3 py-2 font-medium">Batch</th><th className="px-3 py-2 font-medium">Expires</th><th className="px-3 py-2 font-medium text-right">On hand</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{r.productName}</td>
                  <td className="px-3 py-2 num text-ink-muted">{r.batchNumber}</td>
                  <td className="px-3 py-2 text-danger">{formatDate(r.expiryDate)}</td>
                  <td className="px-3 py-2 num text-right">{r.quantityOnHand}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
