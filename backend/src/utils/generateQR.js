// src/utils/generateQR.js
const QRCode = require('qrcode');

/**
 * Generate a QR code image from given data
 * @param {string} data - The string to encode
 * @param {Object} [options] - Optional QR code config
 * @returns {Promise<string>} Base64 PNG data URL
 */
const generateQR = async (data, options = {}) => {
  try {
    return await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H', // High error correction
      type: 'image/png',
      margin: 2,
      width: 300,
      ...options,
    });
  } catch (error) {
    console.error('QR generation failed:', error);
    throw error;
  }
};

module.exports = generateQR;
