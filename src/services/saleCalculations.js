/**
 * Shared line-item/total math used by both PosSaleService (direct sales) and
 * SalesOrderService (quotations/sales orders). Keeping this in one place
 * means a quotation's total and the eventual invoice's total are computed
 * identically — no drift between "what we quoted" and "what we billed".
 */
function computeLineItems(items) {
  let subtotal = 0, discountTotal = 0, taxTotal = 0;

  const lineItems = items.map((item) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const discountAmount = item.discountAmount || 0;
    const taxable = lineSubtotal - discountAmount;
    const taxAmount = taxable * ((item.taxRate || 0) / 100);
    const lineTotal = taxable + taxAmount;

    subtotal += lineSubtotal;
    discountTotal += discountAmount;
    taxTotal += taxAmount;

    return {
      productId: item.productId,
      variantId: item.variantId,
      batchId: item.batchId || null,
      serialNumbers: item.serialNumbers || [],
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount,
      taxRate: item.taxRate || 0,
      taxAmount,
      lineTotal,
    };
  });

  const totalAmount = subtotal - discountTotal + taxTotal;

  return { lineItems, subtotal, discountTotal, taxTotal, totalAmount };
}

module.exports = { computeLineItems };
