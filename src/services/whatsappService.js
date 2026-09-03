/**
 * WhatsappService — per-tenant WhatsApp Business Cloud API (Meta) sender.
 * There is no shared/platform-wide WhatsApp account: each company enters
 * its own whatsappPhoneNumberId/whatsappAccessToken/whatsappBusinessAccountId
 * under Settings (see orgController.updateCompany), the same self-service
 * pattern already established for fbrApiToken and jazzCashTaxPay on
 * Company.js.
 *
 * Every call is graceful: a company with WhatsApp not configured (or
 * turned off) gets a clean { success: false, reason: 'not_configured' }
 * result, never a thrown error — the same "never break the caller's real
 * flow" contract messagingService.sendSms/sendEmail already follow. Every
 * attempt, configured or not, is written to WhatsappMessageLog so a vendor
 * can see whether their integration is actually working (WhatsappLogPage).
 *
 * --- Real-deployment setup ---
 * In Meta's WhatsApp Cloud API, a message send is:
 *   POST https://graph.facebook.com/v19.0/{phoneNumberId}/messages
 *   Authorization: Bearer {accessToken}
 *   { messaging_product: 'whatsapp', to, type: 'template', template: {...} }
 * A company gets phoneNumberId/accessToken/businessAccountId from Meta's
 * WhatsApp Manager (business.facebook.com) after creating a WhatsApp
 * Business Account and verifying a phone number there — nothing this app
 * needs to provision on its behalf.
 */
const Company = require('../models/Company');
const WhatsappMessageLog = require('../models/WhatsappMessageLog');

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

function isConfigured(company) {
  return !!(company && company.whatsappEnabled && company.whatsappPhoneNumberId && company.whatsappAccessToken);
}

async function logAttempt({ companyId, to, type, status, detail, errorMessage }) {
  try {
    await WhatsappMessageLog.create({ companyId, to, type: type || 'other', status, detail: detail || '', errorMessage: errorMessage || null });
  } catch (err) {
    // Logging must never be the reason a caller sees an error — the send
    // result itself (returned to the caller) is what matters.
    console.error('[whatsappService] failed to write WhatsappMessageLog:', err.message);
  }
}

/**
 * Sends a template message via the WhatsApp Cloud API.
 * @param {String} companyId
 * @param {Object} input
 * @param {String} input.to - destination phone number (with country code, e.g. 923001234567)
 * @param {String} input.templateName - a WhatsApp-approved template name (e.g. 'order_confirmation')
 * @param {Array<String>} [input.params] - positional {{1}}, {{2}}... body params for the template
 * @param {String} [input.languageCode] - defaults to 'en'
 * @param {String} [input.type] - log category: 'order_confirmation' | 'payment_reminder' | 'other'
 * @returns {Promise<{success: boolean, reason?: string, error?: string, messageId?: string}>} never throws
 */
async function sendMessage(companyId, { to, templateName, params = [], languageCode = 'en', type = 'other' } = {}) {
  if (!companyId) return { success: false, reason: 'missing_company' };
  if (!to) {
    await logAttempt({ companyId, to: '', type, status: 'failed', errorMessage: 'No destination phone number provided.' });
    return { success: false, reason: 'missing_recipient' };
  }

  let company;
  try {
    company = await Company.findById(companyId).select('whatsappEnabled whatsappPhoneNumberId whatsappAccessToken');
  } catch (err) {
    await logAttempt({ companyId, to, type, status: 'failed', errorMessage: err.message });
    return { success: false, reason: 'lookup_failed', error: err.message };
  }

  if (!isConfigured(company)) {
    console.log(`ℹ WhatsApp is not configured for company ${companyId} — skipping send to ${to} (template: ${templateName}). Set whatsappEnabled/whatsappPhoneNumberId/whatsappAccessToken under Settings to enable this.`);
    await logAttempt({ companyId, to, type, status: 'not_configured', detail: templateName || '' });
    return { success: false, reason: 'not_configured' };
  }

  const url = `${GRAPH_API_BASE}/${company.whatsappPhoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: params.length
        ? [{ type: 'body', parameters: params.map((p) => ({ type: 'text', text: String(p) })) }]
        : [],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${company.whatsappAccessToken}` },
      body: JSON.stringify(body),
    });
    const raw = await response.json().catch(() => null);

    if (!response.ok || !raw) {
      const errorMessage = raw?.error?.message || `WhatsApp API request failed (HTTP ${response.status}).`;
      await logAttempt({ companyId, to, type, status: 'failed', detail: templateName || '', errorMessage });
      return { success: false, reason: 'api_error', error: errorMessage, raw };
    }

    const messageId = raw?.messages?.[0]?.id || null;
    await logAttempt({ companyId, to, type, status: 'sent', detail: templateName || '' });
    return { success: true, messageId, raw };
  } catch (err) {
    await logAttempt({ companyId, to, type, status: 'failed', detail: templateName || '', errorMessage: err.message });
    return { success: false, reason: 'network_error', error: err.message };
  }
}

/**
 * Sends a document (invoice/receipt PDF or image) via the WhatsApp Cloud API.
 * @param {String} companyId
 * @param {Object} input
 * @param {String} input.to
 * @param {String} [input.documentUrl] - publicly reachable URL Meta can fetch the file from
 * @param {String} [input.base64] - base64-encoded file content, used only if documentUrl isn't given (uploaded to Meta's Media endpoint first)
 * @param {String} [input.filename] - shown to the recipient, e.g. 'Invoice-INV-1042.pdf'
 * @param {String} [input.caption]
 * @param {String} [input.mimeType] - required when sending via base64 (defaults to application/pdf)
 * @param {String} [input.type] - log category, same as sendMessage
 * @returns {Promise<{success: boolean, reason?: string, error?: string, messageId?: string}>} never throws
 */
async function sendDocument(companyId, { to, documentUrl, base64, filename, caption, mimeType = 'application/pdf', type = 'other' } = {}) {
  if (!companyId) return { success: false, reason: 'missing_company' };
  if (!to) {
    await logAttempt({ companyId, to: '', type, status: 'failed', errorMessage: 'No destination phone number provided.' });
    return { success: false, reason: 'missing_recipient' };
  }
  if (!documentUrl && !base64) {
    await logAttempt({ companyId, to, type, status: 'failed', errorMessage: 'Either documentUrl or base64 is required.' });
    return { success: false, reason: 'missing_document' };
  }

  let company;
  try {
    company = await Company.findById(companyId).select('whatsappEnabled whatsappPhoneNumberId whatsappAccessToken');
  } catch (err) {
    await logAttempt({ companyId, to, type, status: 'failed', errorMessage: err.message });
    return { success: false, reason: 'lookup_failed', error: err.message };
  }

  if (!isConfigured(company)) {
    console.log(`ℹ WhatsApp is not configured for company ${companyId} — skipping document send to ${to}. Set whatsappEnabled/whatsappPhoneNumberId/whatsappAccessToken under Settings to enable this.`);
    await logAttempt({ companyId, to, type, status: 'not_configured', detail: filename || 'document' });
    return { success: false, reason: 'not_configured' };
  }

  try {
    let mediaId = null;
    let link = documentUrl || null;

    // A raw base64 payload has to be uploaded to Meta's Media endpoint
    // first to get a media id the /messages call can reference — a
    // documentUrl skips this and is referenced directly as a `link`.
    if (!link && base64) {
      const uploadUrl = `${GRAPH_API_BASE}/${company.whatsappPhoneNumberId}/media`;
      const buffer = Buffer.from(base64, 'base64');
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('file', new Blob([buffer], { type: mimeType }), filename || 'document');

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${company.whatsappAccessToken}` },
        body: form,
      });
      const uploadRaw = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !uploadRaw?.id) {
        const errorMessage = uploadRaw?.error?.message || `WhatsApp media upload failed (HTTP ${uploadResponse.status}).`;
        await logAttempt({ companyId, to, type, status: 'failed', detail: filename || 'document', errorMessage });
        return { success: false, reason: 'media_upload_failed', error: errorMessage, raw: uploadRaw };
      }
      mediaId = uploadRaw.id;
    }

    const url = `${GRAPH_API_BASE}/${company.whatsappPhoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: {
        ...(link ? { link } : { id: mediaId }),
        ...(filename ? { filename } : {}),
        ...(caption ? { caption } : {}),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${company.whatsappAccessToken}` },
      body: JSON.stringify(body),
    });
    const raw = await response.json().catch(() => null);

    if (!response.ok || !raw) {
      const errorMessage = raw?.error?.message || `WhatsApp API request failed (HTTP ${response.status}).`;
      await logAttempt({ companyId, to, type, status: 'failed', detail: filename || 'document', errorMessage });
      return { success: false, reason: 'api_error', error: errorMessage, raw };
    }

    const messageId = raw?.messages?.[0]?.id || null;
    await logAttempt({ companyId, to, type, status: 'sent', detail: filename || 'document' });
    return { success: true, messageId, raw };
  } catch (err) {
    await logAttempt({ companyId, to, type, status: 'failed', detail: filename || 'document', errorMessage: err.message });
    return { success: false, reason: 'network_error', error: err.message };
  }
}

module.exports = { sendMessage, sendDocument, isConfigured };
