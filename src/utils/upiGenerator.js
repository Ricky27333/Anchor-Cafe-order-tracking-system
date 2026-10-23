const QRCode = require('qrcode');

/**
 * Generates dynamic UPI Intent string and DataURL QR code for instant scan-and-pay
 * @param {Object} options
 * @param {number} options.amount - Exact charm price amount
 * @param {string} options.orderNumber - e.g. "AC-20261022-0042"
 * @param {string} [options.vpa] - Payee VPA / UPI ID
 * @param {string} [options.payeeName] - Cafe business name
 * @returns {Promise<{ upiString: string, qrDataUrl: string, amount: number, orderNumber: string }>}
 */
async function generateUpiQr({
  amount,
  orderNumber,
  vpa = process.env.CAFE_UPI_VPA || 'anchorcafe@icici',
  payeeName = process.env.CAFE_NAME || 'Anchor Cafe'
}) {
  const formattedAmount = Number(amount).toFixed(2);
  const note = `Anchor Cafe Order ${orderNumber}`;
  const txnRef = `TXN-${Date.now().toString().slice(-8)}`;

  // NPCI standard UPI specification
  const upiString = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${txnRef}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(upiString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#0B2545', // Luxury Coastal Deep Navy
        light: '#FFFFFF'
      }
    });

    return {
      success: true,
      upiString,
      qrDataUrl,
      amount: Number(amount),
      orderNumber,
      vpa,
      payeeName,
      txnRef
    };
  } catch (error) {
    return {
      success: false,
      upiString,
      qrDataUrl: '',
      error: error.message
    };
  }
}

module.exports = {
  generateUpiQr
};
