import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function CarRentalPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('fleet');
  return (
    <div>
      <p className="eyebrow mb-1">{t('carRental.rentals')}</p>
      <p className="page-title mb-4">{t('carRental.carRental')}</p>
      <div className="flex gap-2 mb-5">
        {[['fleet', t('carRental.fleet')], ['bookings', t('carRental.bookings')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'fleet' && <FleetTab />}
      {tab === 'bookings' && <BookingsTab />}
    </div>
  );
}

function FleetTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/car-rental/fleet').then(setFleet).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDelete(v) {
    if (!confirm(t('carRental.confirmRemoveVehicle', { registration: v.registrationNumber }))) return;
    try {
      await api.del(`/car-rental/fleet/${v._id}`);
      toast(t('carRental.vehicleRemoved'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const statusChip = { available: 'chip-accent', rented: 'chip-info', maintenance: 'chip-warning' };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-muted">{t('carRental.fleetSubtitle')}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('carRental.addVehicle')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && fleet.length === 0 && <EmptyState title={t('carRental.noVehiclesYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('carRental.addAVehicle')}</button>} />}
      {!loading && fleet.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fleet.map((v) => (
            <div key={v._id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-semibold text-ink">{v.vehicleClass}</p>
                <span className={statusChip[v.status] || 'chip-neutral'}>{v.status}</span>
              </div>
              <p className="text-xs text-ink-muted mt-1">{v.registrationNumber}</p>
              <p className="num text-sm font-semibold text-accent-strong mt-2">{formatMoney(v.dailyRate, company?.currency)}<span className="text-xs font-normal text-ink-muted">/{t('carRental.day')}</span></p>
              <div className="flex gap-3 mt-3 pt-3 border-t border-rule">
                <button className="btn-ghost !text-accent !px-0 text-xs font-semibold" onClick={() => setEditing(v)}>{t('carRental.edit')}</button>
                <button className="btn-ghost !text-danger !px-0 text-xs font-semibold" onClick={() => handleDelete(v)}>{t('carRental.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && <VehicleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <VehicleEditForm vehicle={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function VehicleEditForm({ vehicle, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ vehicleClass: vehicle.vehicleClass, dailyRate: vehicle.dailyRate, status: vehicle.status });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/car-rental/fleet/${vehicle._id}`, { ...form, dailyRate: Number(form.dailyRate) });
      toast(t('carRental.vehicleUpdated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-4">{t('carRental.editVehicle')}: {vehicle.registrationNumber}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('carRental.vehicleClass')}</label>
            <input required className="field-input" value={form.vehicleClass} onChange={(e) => setForm({ ...form, vehicleClass: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('carRental.dailyRate')}</label>
            <input type="number" required className="field-input num" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('carRental.status')}</label>
            <select className="field-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="available">{t('carRental.available')}</option>
              <option value="rented">{t('carRental.rented')}</option>
              <option value="maintenance">{t('carRental.maintenance')}</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('carRental.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('carRental.saving') : t('carRental.save')}</button>
        </div>
      </form>
    </div>
  );
}

function VehicleForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', vehicleClass: '', registrationNumber: '', dailyRate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/car-rental/fleet', { ...form, dailyRate: Number(form.dailyRate) });
      toast(t('carRental.vehicleAdded'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-4">{t('carRental.addVehicle')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('carRental.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('carRental.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('carRental.vehicleClass')}</label>
            <input required autoFocus className="field-input" value={form.vehicleClass} onChange={(e) => setForm({ ...form, vehicleClass: e.target.value })} placeholder={t('carRental.vehicleClassPlaceholder')} />
          </div>
          <div>
            <label className="field-label">{t('carRental.registrationNumber')}</label>
            <input required className="field-input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('carRental.dailyRate')}</label>
            <input type="number" required className="field-input num" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('carRental.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('carRental.saving') : t('carRental.save')}</button>
        </div>
      </form>
    </div>
  );
}

function BookingsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [returning, setReturning] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  function load() {
    setLoading(true);
    api.get('/car-rental/bookings').then(setBookings).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const statusChip = { booked: 'chip-accent', returned: 'chip-info', cancelled: 'chip-danger' };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-muted">{t('carRental.bookingsSubtitle')}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-base leading-none">add</span>
          {t('carRental.newBooking')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && bookings.length === 0 && <EmptyState title={t('carRental.noBookingsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('carRental.createABooking')}</button>} />}
      {!loading && bookings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map((b) => (
            <div key={b._id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-semibold text-ink">{b.vehicleClass}</p>
                <span className={statusChip[b.status] || 'chip-neutral'}>{b.status}</span>
              </div>
              <p className="text-xs text-ink-muted mt-1 num">{b.startDate?.slice(0, 10)} → {b.endDate?.slice(0, 10)}</p>
              {b.status === 'booked' && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-rule">
                  <button className="btn-ghost !text-accent !px-0 text-xs font-semibold" onClick={() => setReturning(b)}>{t('carRental.returnVehicle')}</button>
                  <button className="btn-ghost !text-danger !px-0 text-xs font-semibold" onClick={() => setCancelling(b)}>{t('carRental.cancel')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && <BookingForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {returning && <ReturnForm booking={returning} onClose={() => setReturning(null)} onSaved={() => { setReturning(null); load(); }} />}
      {cancelling && <CancelBookingForm booking={cancelling} onClose={() => setCancelling(null)} onSaved={() => { setCancelling(null); load(); }} />}
    </div>
  );
}

function CancelBookingForm({ booking, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [refundPercent, setRefundPercent] = useState(100);
  const [refundAccountId, setRefundAccountId] = useState('');
  const [forfeitRevenueAccountId, setForfeitRevenueAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const hasDeposit = booking.depositAmount > 0;

  useEffect(() => { if (hasDeposit) api.get('/org/accounts').then(setAccounts).catch(() => {}); }, [hasDeposit]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/car-rental/bookings/${booking._id}/cancel`, hasDeposit ? { refundPercent: Number(refundPercent), refundAccountId, forfeitRevenueAccountId } : {});
      toast(t('carRental.bookingCancelled'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-4">{t('carRental.cancelBooking')}: {booking.vehicleClass}</p>
        {hasDeposit ? (
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">{t('carRental.depositTakenNote', { amount: booking.depositAmount })}</p>
            <div>
              <label className="field-label">{t('carRental.refundPercent')}</label>
              <input type="number" min="0" max="100" required className="field-input num" value={refundPercent} onChange={(e) => setRefundPercent(e.target.value)} />
            </div>
            {Number(refundPercent) > 0 && (
              <div>
                <label className="field-label">{t('carRental.refundFromAccount')}</label>
                <select required className="field-input" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
                  <option value="">{t('carRental.selectEllipsis')}</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {Number(refundPercent) < 100 && (
              <div>
                <label className="field-label">{t('carRental.forfeitedAmountPostsTo')}</label>
                <select required className="field-input" value={forfeitRevenueAccountId} onChange={(e) => setForfeitRevenueAccountId(e.target.value)}>
                  <option value="">{t('carRental.selectEllipsis')}</option>
                  {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t('carRental.noDepositTakenNote')}</p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('carRental.back')}</button>
          <button type="submit" disabled={saving} className="btn-danger">{saving ? t('carRental.cancelling') : t('carRental.confirmCancel')}</button>
        </div>
      </form>
    </div>
  );
}

function BookingForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [form, setForm] = useState({ branchId: '', vehicleClass: '', customerId: '', startDate: '', endDate: '', rentalBillingProductId: '', rentalBillingVariantId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/car-rental/fleet').then(setFleet).catch(() => {});
  }, []);

  const vehicleClasses = [...new Set(fleet.map((v) => v.vehicleClass))];
  const selectedProduct = products.find((p) => p._id === form.rentalBillingProductId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/car-rental/bookings', form);
      toast(t('carRental.bookingCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-4">{t('carRental.newBooking')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('carRental.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('carRental.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('carRental.vehicleClass')}</label>
            {vehicleClasses.length > 0 ? (
              <select required className="field-input" value={form.vehicleClass} onChange={(e) => setForm({ ...form, vehicleClass: e.target.value })}>
                <option value="">{t('carRental.selectEllipsis')}</option>
                {vehicleClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input required className="field-input" value={form.vehicleClass} onChange={(e) => setForm({ ...form, vehicleClass: e.target.value })} placeholder={t('carRental.vehicleClassPlaceholder')} />
            )}
          </div>
          <div>
            <label className="field-label">{t('carRental.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('carRental.selectEllipsis')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('carRental.startDate')}</label>
              <input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('carRental.endDate')}</label>
              <input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">{t('carRental.billingProduct')}</label>
            <select required className="field-input" value={form.rentalBillingProductId} onChange={(e) => setForm({ ...form, rentalBillingProductId: e.target.value, rentalBillingVariantId: '' })}>
              <option value="">{t('carRental.selectEllipsis')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {selectedProduct && (
            <div>
              <label className="field-label">{t('carRental.variant')}</label>
              <select required className="field-input" value={form.rentalBillingVariantId} onChange={(e) => setForm({ ...form, rentalBillingVariantId: e.target.value })}>
                <option value="">{t('carRental.selectEllipsis')}</option>
                {selectedProduct.variants?.map((v) => <option key={v._id} value={v._id}>{v.name || v.sku || v._id}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('carRental.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('carRental.saving') : t('carRental.save')}</button>
        </div>
      </form>
    </div>
  );
}

function ReturnForm({ booking, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);
  useEffect(() => { if (branchId) api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {}); }, [branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/car-rental/bookings/${booking._id}/return`, { warehouseId });
      toast(t('carRental.vehicleReturned'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-4">{t('carRental.returnVehicle')}: {booking.vehicleClass}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('carRental.branch')}</label>
            <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('carRental.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('carRental.warehouse')}</label>
            <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
              <option value="">{t('carRental.selectEllipsis')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('carRental.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('carRental.returning') : t('carRental.return')}</button>
        </div>
      </form>
    </div>
  );
}
