// qrService.js - Generate and validate QR codes
const QRCode = require('qrcode');

const generateQRCode = async (text) => {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    console.error('QR generation failed:', err);
    throw new Error('Failed to generate QR code');
  }
};

const validateQRCode = (scannedData, expectedData) => {
  return scannedData === expectedData;
};

module.exports = { generateQRCode, validateQRCode };
