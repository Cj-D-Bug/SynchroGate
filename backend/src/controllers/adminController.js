const crypto = require('crypto');
const { firestore } = require('../config/firebase');
const { generateQRCodeImage } = require('../utils/generateQR');
const { env } = require('../config/env');

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

/** Parent verification: create token and optionally send email. Admin only. */
exports.sendParentVerificationEmail = async (req, res) => {
  try {
    const parentId = req.body.parentId || req.params.parentId;
    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required' });
    }

    const parentDoc = await firestore.collection('users').doc(parentId).get();
    if (!parentDoc.exists) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const parentData = parentDoc.data();
    if (String(parentData.role || '').toLowerCase() !== 'parent') {
      return res.status(400).json({ error: 'User is not a parent' });
    }

    const email = (parentData.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: 'Parent has no email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await firestore.collection('parent_verification_tokens').doc(token).set({
      parentId,
      email,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
    });

    const baseUrl = (env.VERIFICATION_BASE_URL || env.APP_BASE_URL || '').replace(/\/$/, '');
    const verificationUrl = baseUrl
      ? `${baseUrl}/api/verify-parent?token=${token}`
      : null;

    let emailSent = false;
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && verificationUrl) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT) || 587,
          secure: env.SMTP_SECURE === 'true',
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
        const parentName = [parentData.firstName, parentData.lastName].filter(Boolean).join(' ').trim() || 'Parent';
        await transporter.sendMail({
          from: env.SMTP_FROM || env.SMTP_USER,
          to: email,
          subject: 'SyncroGate – Verify your parent account',
          text: `Hello ${parentName},\n\nAn administrator has requested that you verify your parent account. Tap the link below to verify and start using the parent dashboard:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not request this, you can ignore this email.\n\n— SyncroGate`,
          html: `<p>Hello ${parentName},</p><p>An administrator has requested that you verify your parent account. Tap the link below to verify and start using the parent dashboard:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p><p>— SyncroGate</p>`,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('Parent verification email send failed:', mailErr.message);
      }
    }

    res.status(200).json({
      success: true,
      emailSent,
      verificationUrl: verificationUrl || `${env.APP_BASE_URL || ''}/api/verify-parent?token=${token}`,
      message: emailSent
        ? 'Verification email sent to parent.'
        : 'Verification link created. Send the link to the parent\'s email manually if SMTP is not configured.',
    });
  } catch (err) {
    console.error('Error sending parent verification:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification' });
  }
};

/** Public: verify parent by token (from email link). No auth required. */
exports.verifyParentByToken = async (req, res) => {
  try {
    const token = (req.query.token || req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const tokenDoc = await firestore.collection('parent_verification_tokens').doc(token).get();
    if (!tokenDoc.exists) {
      return res.status(404).json({ success: false, error: 'Invalid or expired link' });
    }

    const data = tokenDoc.data();
    if (data.used) {
      return res.status(400).json({ success: false, error: 'This link has already been used' });
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'This link has expired' });
    }

    const parentId = data.parentId;
    if (!parentId) {
      return res.status(400).json({ success: false, error: 'Invalid token data' });
    }

    const userRef = firestore.collection('users').doc(parentId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ success: false, error: 'Parent account not found' });
    }

    await userRef.update({
      verificationStatus: 'verified',
      isVerify: true,
      updatedAt: new Date().toISOString(),
    });

    await firestore.collection('parent_verification_tokens').doc(token).update({ used: true });

    res.status(200).json({
      success: true,
      message: 'Your account has been verified. You can now use the parent dashboard.',
    });
  } catch (err) {
    console.error('Error verifying parent by token:', err);
    res.status(500).json({ success: false, error: err.message || 'Verification failed' });
  }
};
