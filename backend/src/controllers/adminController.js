import { User } from '../models/mysql/User.js';
import { generateQRCodeImage } from '../utils/generateQR.js';

export const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role'], // select needed fields only
    });
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const generateQRForUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Assuming generateQRCodeImage accepts userId or data to generate QR code image URL/base64
    const qr = await generateQRCodeImage({ userId });

    res.json({ qr });
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};
