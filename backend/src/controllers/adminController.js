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
    const isLocalhost = !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl);
    const parentName = [parentData.firstName, parentData.lastName].filter(Boolean).join(' ').trim() || 'Parent';
    const emailHtml = `<p>Hello ${parentName},</p><p>An administrator has requested that you verify your parent account. Tap the link below to verify and start using the parent dashboard:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p><p>— SyncroGate</p>`;
    const emailText = `Hello ${parentName},\n\nAn administrator has requested that you verify your parent account. Tap the link below to verify and start using the parent dashboard:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not request this, you can ignore this email.\n\n— SyncroGate`;

    let emailSent = false;

    // Try Resend first (works on Railway; no SMTP timeout)
    if (env.RESEND_API_KEY && verificationUrl && !isLocalhost) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: env.RESEND_FROM || 'SyncroGate <onboarding@resend.dev>',
          to: [email],
          subject: 'SyncroGate – Verify your parent account',
          html: emailHtml,
        });
        if (error) throw new Error(error.message);
        emailSent = true;
      } catch (resendErr) {
        console.error('Parent verification email (Resend) failed:', resendErr.message);
      }
    }

    // Fallback to SMTP if Resend failed or not configured
    if (!emailSent && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && verificationUrl && !isLocalhost) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT) || 587,
          secure: env.SMTP_SECURE === 'true',
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
        });
        await transporter.sendMail({
          from: env.SMTP_FROM || env.SMTP_USER,
          to: email,
          subject: 'SyncroGate – Verify your parent account',
          text: emailText,
          html: emailHtml,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('Parent verification email (SMTP) failed:', mailErr.message);
      }
    }

    if (!emailSent) {
      if (!env.RESEND_API_KEY) console.log('⚠️ Parent verification: Add RESEND_API_KEY in Railway Variables (resend.com) for automatic email.');
      else if (isLocalhost) console.log('⚠️ Parent verification: Set VERIFICATION_BASE_URL to your public backend URL (e.g. https://your-api.railway.app).');
    }

    const verificationUrlFinal = verificationUrl || `${env.APP_BASE_URL || ''}/api/verify-parent?token=${token}`;
    res.status(200).json({
      success: true,
      emailSent,
      verificationUrl: verificationUrlFinal,
      message: emailSent
        ? 'Verification email sent to parent. They can tap the link in the email to verify.'
        : 'SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS and VERIFICATION_BASE_URL to backend .env (see .env.example for Gmail). Until then, copy the link below and send it to the parent.',
    });
  } catch (err) {
    console.error('Error sending parent verification:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification' });
  }
};

/** Public: verify parent by token (from email link). No auth required. Returns HTML for browser. */
exports.verifyParentByToken = async (req, res) => {
  const htmlSuccess = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SyncroGate – Verified</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;background:#f9fafb}h1{color:#16a34a;font-size:24px}p{color:#374151;line-height:1.6}.btn{display:inline-block;margin-top:16px;padding:12px 24px;background:#004f89;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}</style></head><body><h1>✓ Account Verified</h1><p>${msg}</p><p>Open the SyncroGate app to use the parent dashboard.</p></body></html>`;
  const htmlError = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SyncroGate – Error</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;background:#f9fafb}h1{color:#dc2626;font-size:24px}p{color:#374151;line-height:1.6}</style></head><body><h1>Verification Failed</h1><p>${msg}</p></body></html>`;

  try {
    const token = (req.query.token || req.body?.token || '').trim();
    if (!token) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('Invalid link. Token is missing.'));
    }

    const tokenDoc = await firestore.collection('parent_verification_tokens').doc(token).get();
    if (!tokenDoc.exists) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(htmlError('Invalid or expired link. Please request a new verification email from the admin.'));
    }

    const data = tokenDoc.data();
    if (data.used) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('This link has already been used. Your account is already verified.'));
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('This link has expired. Please request a new verification email from the admin.'));
    }

    const parentId = data.parentId;
    if (!parentId) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('Invalid token data.'));
    }

    const userRef = firestore.collection('users').doc(parentId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(htmlError('Parent account not found.'));
    }

    await userRef.update({
      verificationStatus: 'verified',
      isVerify: true,
      updatedAt: new Date().toISOString(),
    });

    await firestore.collection('parent_verification_tokens').doc(token).update({ used: true });

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlSuccess('Your parent account has been verified successfully.'));
  } catch (err) {
    console.error('Error verifying parent by token:', err);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(htmlError('Verification failed. Please try again or contact support.'));
  }
};
