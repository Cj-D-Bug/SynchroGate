const { firestore } = require('../config/firebase');
const { generateQRCodeImage } = require('../utils/generateQR');

exports.getUsers = async (req, res) => {
  try {
    const usersSnapshot = await firestore.collection('users').get();
    const users = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        name: userData.firstName + ' ' + userData.lastName,
        email: userData.email,
        role: userData.role
      });
    });
    
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

exports.generateQRForUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get user data from Firebase
    const userDoc = await firestore.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    if (userData.role !== 'student') {
      return res.status(400).json({ error: 'QR codes can only be generated for students' });
    }

    // Generate QR code for the student
    const qr = await generateQRCodeImage({ 
      userId,
      studentId: userData.studentId,
      name: userData.firstName + ' ' + userData.lastName
    });

    res.json({ qr });
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
};
