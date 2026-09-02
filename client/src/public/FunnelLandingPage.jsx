import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

// The actual public page a customer visits, e.g. https://app.example/f/summer-sale
// No auth, no AppLayout/Sidebar — a clean standalone page, styled like
// client/src/portal/PortalApp.jsx's LoginPage (min-h-screen, centered
// card, same field-input/btn-primary utility classes as the rest of the
// app). Hits the PUBLIC backend router (src/routes/publicFunnelRoutes.js,
// mounted at /public/funnels — no JWT required) via the same `api` fetch
// wrapper the authenticated app uses; that wrapper only *attaches* a
// token when one happens to be in localStorage, it never requires one, so
// it works fine for an anonymous visitor here too.
//
// A funnel is a ORDERED LIST of pages/steps (`funnel.pages`, always
// populated by the backend even for a legacy single-page funnel — see
// funnelService.effectivePages). This component just tracks which step
// index the visitor is on and swaps which page object it renders; no full
// page reload between steps.
export function FunnelLandingPage() {
  const { slug } = useParams();
  const [funnel, setFunnel] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get(`/public/funnels/${slug}`)
      .then((data) => { if (!cancelled) setFunnel(data); })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [slug]);

  const pages = funnel?.pages || [];
  const page = pages[stepIndex];
  const isLastStep = stepIndex === pages.length - 1;

  async function handleFormSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/public/funnels/${slug}/submit`, values);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCta() {
    if (!page) return;
    if (page.ctaAction === 'next_step') {
      if (isLastStep) return;
      setStepIndex((i) => i + 1);
    } else if (page.ctaAction === 'external_url') {
      if (page.externalUrl) window.location.href = page.externalUrl;
    }
    // submit_form and book_appointment render their own inline widget/form —
    // handled below, not via this generic CTA click.
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-muted">This page isn't available.</p>
      </div>
    );
  }

  if (!funnel || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card p-6 w-full max-w-lg">
        {pages.length > 1 && (
          <div className="flex items-center gap-1.5 mb-4">
            {pages.map((p, i) => (
              <div key={p.order ?? i} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-surface-sunken'}`} />
            ))}
          </div>
        )}

        <p className="font-display text-2xl mb-2">{page.headline || funnel.headline || funnel.name}</p>
        {(page.bodyContent || funnel.bodyContent) && (
          <p className="text-sm text-ink-muted mb-5 whitespace-pre-wrap">{page.bodyContent || funnel.bodyContent}</p>
        )}

        {page.ctaAction === 'submit_form' ? (
          submitted ? (
            <p className="text-sm text-accent-strong">Thanks — we've got your details and will be in touch.</p>
          ) : (
            <FunnelSubmitForm
              formFields={funnel.formFields}
              values={values}
              setValues={setValues}
              error={error}
              submitting={submitting}
              onSubmit={handleFormSubmit}
              ctaText={page.ctaText}
            />
          )
        ) : page.ctaAction === 'book_appointment' ? (
          <AppointmentBookingWidget slug={slug} pageOrder={page.order} />
        ) : (
          <button type="button" className="btn-primary w-full mt-2" onClick={handleCta} disabled={isLastStep && page.ctaAction === 'next_step'}>
            {page.ctaText || 'Continue'}
          </button>
        )}
      </div>
    </div>
  );
}

function FunnelSubmitForm({ formFields, values, setValues, error, submitting, onSubmit, ctaText }) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {(formFields || []).map((field) => (
        <label key={field.key} className="block text-sm">
          <span className="block text-ink-muted mb-1">
            {field.label}{field.required && <span className="text-red-600"> *</span>}
          </span>
          {field.type === 'textarea' ? (
            <textarea
              className="field-input w-full"
              rows={4}
              required={field.required}
              value={values[field.key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          ) : (
            <input
              className="field-input w-full"
              type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
              required={field.required}
              value={values[field.key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          )}
        </label>
      ))}
      <button type="submit" disabled={submitting} className="btn-primary w-full mt-2">
        {submitting ? 'Submitting…' : (ctaText || 'Submit')}
      </button>
    </form>
  );
}

// Simple slot-picker embedded on a 'book_appointment' funnel page. Reuses
// the real appointment booking engine via the public
// /public/funnels/:slug/appointment-slots and .../book-appointment
// endpoints (src/services/appointmentService.js under the hood) — this is
// NOT a separate booking system.
function AppointmentBookingWidget({ slug, pageOrder }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setSelectedSlot(null);
    api.get(`/public/funnels/${slug}/appointment-slots?pageOrder=${pageOrder}&date=${date}`)
      .then((data) => { if (!cancelled) setSlots(data); })
      .catch((err) => { if (!cancelled) { setSlots([]); setError(err.message || 'Could not load available times.'); } });
    return () => { cancelled = true; };
  }, [slug, pageOrder, date]);

  async function handleBook(e) {
    e.preventDefault();
    if (!selectedSlot) return;
    setError('');
    setBooking(true);
    try {
      await api.post(`/public/funnels/${slug}/book-appointment`, {
        pageOrder, startTime: selectedSlot.startTime, endTime: selectedSlot.endTime, ...contact,
      });
      setBooked(true);
    } catch (err) {
      setError(err.message || 'Could not book that slot — it may have just been taken.');
    } finally {
      setBooking(false);
    }
  }

  if (booked) {
    return <p className="text-sm text-accent-strong">You're booked! We'll be in touch with a confirmation.</p>;
  }

  return (
    <form onSubmit={handleBook} className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <label className="block text-sm">
        <span className="block text-ink-muted mb-1">Date</span>
        <input type="date" className="field-input w-full" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div>
        <span className="block text-sm text-ink-muted mb-1">Available times</span>
        {slots === null ? (
          <p className="text-xs text-ink-muted">Loading times…</p>
        ) : slots.length === 0 ? (
          <p className="text-xs text-ink-muted">No open times on this date — try another date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const isSelected = selectedSlot?.startTime === s.startTime;
              return (
                <button
                  type="button"
                  key={s.startTime}
                  onClick={() => setSelectedSlot(s)}
                  className={isSelected ? 'chip-accent !py-1.5' : 'chip-neutral !py-1.5 hover:opacity-80'}
                >
                  {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="space-y-3 pt-2 border-t border-rule">
          <label className="block text-sm">
            <span className="block text-ink-muted mb-1">Name</span>
            <input required className="field-input w-full" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
          </label>
          <label className="block text-sm">
            <span className="block text-ink-muted mb-1">Phone</span>
            <input className="field-input w-full" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
          </label>
          <label className="block text-sm">
            <span className="block text-ink-muted mb-1">Email</span>
            <input type="email" className="field-input w-full" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
          </label>
          <button type="submit" disabled={booking} className="btn-primary w-full">
            {booking ? 'Booking…' : 'Confirm booking'}
          </button>
        </div>
      )}
    </form>
  );
}
