// qrService.js - Generate and validate QR codes
import QRCode from 'qrcode';

export const generateQRCode = async (text) => {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    console.error('QR generation failed:', err);
    throw new Error('Failed to generate QR code');
  }
};

export const validateQRCode = (scannedData, expectedData) => {
  return scannedData === expectedData;
};
