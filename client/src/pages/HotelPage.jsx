import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { booked: 'chip-neutral', checked_in: 'chip-warning', checked_out: 'chip-accent', cancelled: 'chip-danger' };
const ROOM_CHIP = { available: 'chip-accent', occupied: 'chip-warning', cleaning: 'chip-neutral', maintenance: 'chip-danger' };

export function HotelPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('reservations');
  return (
    <div>
      <p className="page-title mb-1">{t('hotel.title')}</p>
      <p className="text-sm text-ink-muted mb-5">{t('hotel.subtitle')}</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['reservations', t('hotel.reservations')], ['rooms', t('hotel.rooms')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'reservations' && <ReservationsTab />}
      {tab === 'rooms' && <RoomsTab />}
    </div>
  );
}

function ReservationsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/hotel/reservations').then(setReservations).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {loading && <Loading />}
        {!loading && reservations.length === 0 && (
          <EmptyState title={t('hotel.noReservationsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('hotel.bookOne')}</button>} />
        )}
        {!loading && reservations.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-rule flex items-center justify-between bg-paper">
              <p className="font-display font-semibold text-ink">{t('hotel.roomStatusAndReservationLedger')}</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hotel.bookReservation')}</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-semibold">{t('hotel.room')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('hotel.guest')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('hotel.checkIn')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('hotel.checkOut')}</th>
                    <th className="px-4 py-2.5 font-semibold">{t('hotel.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r._id} onClick={() => setSelected(r)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper transition-colors ${selected?._id === r._id ? 'bg-accent-soft/40' : ''}`}>
                      <td className="px-4 py-3 num font-medium">{r.roomId?.roomNumber} <span className="font-sans font-normal text-ink-muted text-xs">({r.roomId?.roomType})</span></td>
                      <td className="px-4 py-3">{r.customerId?.name || r.guestName || t('hotel.walkIn')}</td>
                      <td className="px-4 py-3 text-ink-muted">{formatDate(r.checkInDate)}</td>
                      <td className="px-4 py-3 text-ink-muted">{formatDate(r.checkOutDate)}</td>
                      <td className="px-4 py-3"><span className={STATUS_CHIP[r.status]}>{r.status.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {selected && <ReservationPanel reservation={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <BookingForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BookingForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ roomId: '', customerId: '', checkInDate: '', checkOutDate: '', guests: 1, depositAmount: '', advanceReceivedInAccountId: '', depositLiabilityAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/hotel/rooms').then((rows) => setRooms(rows.filter((r) => r.status !== 'maintenance'))).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, customerId: form.customerId || undefined };
      if (form.depositAmount) {
        payload.depositAmount = Number(form.depositAmount);
        if (!form.advanceReceivedInAccountId || !form.depositLiabilityAccountId) {
          throw new Error(t('hotel.depositAccountsRequired'));
        }
      } else {
        delete payload.depositAmount; delete payload.advanceReceivedInAccountId; delete payload.depositLiabilityAccountId;
      }
      await api.post('/hotel/reservations', payload);
      toast(t('hotel.reservationBooked'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold mb-4">{t('hotel.bookAReservation')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('hotel.room')}</label>
            <select required className="field-input" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">{t('hotel.select')}</option>
              {rooms.map((r) => <option key={r._id} value={r._id}>{r.roomNumber}: {r.roomType} ({r.status})</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('hotel.customer')}</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('hotel.walkIn')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('hotel.checkIn')}</label><input type="date" required className="field-input" value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} /></div>
            <div><label className="field-label">{t('hotel.checkOut')}</label><input type="date" required className="field-input" value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} /></div>
          </div>
          <div><label className="field-label">{t('hotel.guests')}</label><input type="number" min="1" className="field-input num" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} /></div>

          <div className="tear-line" />
          <p className="text-xs text-ink-muted">{t('hotel.optionalDepositNote')}</p>
          <div><label className="field-label">{t('hotel.depositAmount')}</label><input type="number" className="field-input num" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} placeholder={t('hotel.leaveBlankForNone')} /></div>
          {form.depositAmount && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label">{t('hotel.receivedInto')}</label>
                <select className="field-input" value={form.advanceReceivedInAccountId} onChange={(e) => setForm({ ...form, advanceReceivedInAccountId: e.target.value })}>
                  <option value="">{t('hotel.select')}</option>
                  {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">{t('hotel.liabilityAccount')}</label>
                <select className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}>
                  <option value="">{t('hotel.select')}</option>
                  {accounts.filter((a) => a.type === 'liability').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hotel.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hotel.booking') : t('hotel.book')}</button>
        </div>
      </form>
    </div>
  );
}

function ReservationPanel({ reservation, onClose, onChanged }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [extraProductId, setExtraProductId] = useState('');
  const [extraQty, setExtraQty] = useState(1);
  const [warehouseId, setWarehouseId] = useState('');
  const [finalPaymentAccountId, setFinalPaymentAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
    if (reservation.branchId) api.get(`/org/warehouses?branchId=${reservation.branchId}`).then(setWarehouses).catch(() => {});
  }, [reservation._id]);

  async function checkIn() {
    setBusy(true);
    try {
      await api.post(`/hotel/reservations/${reservation._id}/check-in`);
      toast(t('hotel.checkedInRoomOccupied'), 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function addExtra() {
    const product = products.find((p) => p._id === extraProductId);
    if (!product) return;
    setBusy(true);
    try {
      await api.post(`/hotel/reservations/${reservation._id}/extras`, {
        productId: product._id, variantId: product.variants[0]?._id,
        description: product.name, quantity: Number(extraQty), unitPrice: product.sellingPrice,
      });
      toast(t('hotel.extraChargeAdded'), 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function checkOut() {
    setBusy(true);
    try {
      const result = await api.post(`/hotel/reservations/${reservation._id}/check-out`, {
        warehouseId, finalPaymentAccountId: finalPaymentAccountId || undefined,
      });
      toast(`${t('hotel.checkedOutBilled')} ${formatMoney(result.grandTotal, company?.currency)}.`, 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.post(`/hotel/reservations/${reservation._id}/cancel`);
      toast(t('hotel.reservationCancelled'), 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg font-semibold">{reservation.roomId?.roomNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hotel.close')}</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{formatDate(reservation.checkInDate)} → {formatDate(reservation.checkOutDate)} · {reservation.guests} {reservation.guests === 1 ? t('hotel.guest') : t('hotel.guestsLower')}</p>

      {reservation.status === 'booked' && (
        <div className="flex gap-2 mb-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={checkIn}>{t('hotel.checkIn')}</button>
          <button className="btn-secondary" disabled={busy} onClick={cancel}>{t('hotel.cancel')}</button>
        </div>
      )}

      {reservation.status === 'checked_in' && (
        <>
          <p className="eyebrow mb-2">{t('hotel.addAnExtraCharge')}</p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <select className="field-input col-span-2" value={extraProductId} onChange={(e) => setExtraProductId(e.target.value)}>
              <option value="">{t('hotel.select')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            <input type="number" min="1" className="field-input num" value={extraQty} onChange={(e) => setExtraQty(e.target.value)} />
          </div>
          <button className="btn-secondary w-full mb-4" disabled={!extraProductId || busy} onClick={addExtra}>{t('hotel.addCharge')}</button>

          <div className="tear-line my-2" />
          <p className="eyebrow mb-2">{t('hotel.checkOut')}</p>
          <div className="space-y-2 mb-2">
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t('hotel.warehouseForSaleDocument')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
            <select className="field-input" value={finalPaymentAccountId} onChange={(e) => setFinalPaymentAccountId(e.target.value)}>
              <option value="">{t('hotel.finalPaymentAccountIfBalance')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn-primary w-full" disabled={!warehouseId || busy} onClick={checkOut}>
            {busy ? t('hotel.checkingOut') : t('hotel.checkOutAndBill')}
          </button>
        </>
      )}

      {reservation.status === 'checked_out' && <p className="text-sm text-accent-strong font-medium">{t('hotel.checkedOutBilledAndClosed')}</p>}
      {reservation.status === 'cancelled' && <p className="text-sm text-danger font-medium">{t('hotel.cancelled')}</p>}
    </div>
  );
}

function RoomsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit

  function load() {
    setLoading(true);
    api.get('/hotel/rooms').then(setRooms).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function markClean(roomId) {
    try {
      await api.post(`/hotel/rooms/${roomId}/mark-clean`);
      toast(t('hotel.roomMarkedAvailable'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleRemove(r) {
    if (!window.confirm(t('hotel.confirmRemoveRoom', { number: r.roomNumber }))) return;
    try {
      await api.del(`/hotel/rooms/${r._id}`);
      toast(t('hotel.roomRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setEditing({})}>{t('hotel.addRoom')}</button>
      </div>
      {loading && <Loading />}
      {!loading && rooms.length === 0 && <EmptyState title={t('hotel.noRoomsYet')} action={<button className="btn-primary" onClick={() => setEditing({})}>{t('hotel.addARoom')}</button>} />}
      {!loading && rooms.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rooms.map((r) => (
            <div key={r._id} className="card p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{r.roomNumber}</p>
                <span className={ROOM_CHIP[r.status]}>{r.status}</span>
              </div>
              <p className="text-xs text-ink-muted">{r.roomType}</p>
              <p className="num text-sm mt-1 font-medium">{formatMoney(r.ratePerNight)}/{t('hotel.night')}</p>
              <div className="flex items-center gap-3 mt-2">
                {r.status === 'cleaning' && <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => markClean(r._id)}>{t('hotel.markClean')}</button>}
                <button className="btn-ghost !text-ink-muted !px-0 text-xs" onClick={() => setEditing(r)}>{t('hotel.edit')}</button>
                {r.status !== 'occupied' && <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => handleRemove(r)}>{t('hotel.remove')}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {editing !== null && <RoomForm room={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RoomForm({ room, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !room._id;
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    branchId: room.branchId || '', roomNumber: room.roomNumber || '', roomType: room.roomType || '',
    ratePerNight: room.ratePerNight ?? '', billingProductId: room.billingProductId || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      api.get('/org/branches').then(setBranches).catch(() => {});
      api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    }
  }, [isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const product = products.find((p) => p._id === form.billingProductId);
        if (!product) throw new Error(t('hotel.selectBillingProductServiceTracked'));
        await api.post('/hotel/rooms', { ...form, ratePerNight: Number(form.ratePerNight), billingVariantId: product.variants[0]?._id });
        toast(t('hotel.roomAdded'), 'success');
      } else {
        await api.put(`/hotel/rooms/${room._id}`, { roomNumber: form.roomNumber, roomType: form.roomType, ratePerNight: Number(form.ratePerNight) });
        toast(t('hotel.roomUpdated'), 'success');
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
        <p className="font-display text-lg font-semibold mb-4">{isNew ? t('hotel.addRoom') : t('hotel.editRoom')}</p>
        <div className="space-y-3">
          {isNew && (
            <div>
              <label className="field-label">{t('hotel.branch')}</label>
              <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">{t('hotel.select')}</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="field-label">{t('hotel.roomNumber')}</label><input required className="field-input" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} /></div>
          <div><label className="field-label">{t('hotel.type')}</label><input className="field-input" value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })} placeholder={t('hotel.typePlaceholder')} /></div>
          <div><label className="field-label">{t('hotel.ratePerNight')}</label><input type="number" required className="field-input num" value={form.ratePerNight} onChange={(e) => setForm({ ...form, ratePerNight: e.target.value })} /></div>
          {isNew && (
            <div>
              <label className="field-label">{t('hotel.billingProductService')}</label>
              <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
                <option value="">{t('hotel.select')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              {products.length === 0 && <p className="text-xs text-warning mt-1">{t('hotel.noServiceTrackedProducts')}</p>}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hotel.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hotel.saving') : t('hotel.save')}</button>
        </div>
      </form>
    </div>
  );
}
