const crypto = require('crypto');
const { firestore } = require('../config/firebase');
const { generateQRCodeImage } = require('../utils/generateQR');
const { env } = require('../config/env');
const pushService = require('../services/pushService');

const sendMailWithTimeout = async (transporter, mailOptions, timeoutMs = 3000) => {
  if (!transporter?.sendMail) throw new Error('Invalid transporter');
  return await Promise.race([
    transporter.sendMail(mailOptions),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)),
  ]);
};

const docExists = (snap) => {
  if (!snap) return false;
  // firebase-admin uses boolean `exists`; firebase web SDK uses function `exists()`
  try {
    if (typeof snap.exists === 'function') return !!snap.exists();
  } catch {}
  return !!snap.exists;
};

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

    // Save token on parent user doc so they can verify in-app even if SMTP fails
    try {
      await firestore.collection('users').doc(parentId).set({
        parentVerificationToken: token,
        parentVerificationTokenCreatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Failed to store parent verification token on user doc (non-blocking):', e?.message);
    }

    const baseUrl = (env.VERIFICATION_BASE_URL || env.APP_BASE_URL || '').replace(/\/$/, '');
    const verificationUrl = baseUrl
      ? `${baseUrl}/api/verify-parent?token=${token}`
      : null;
    const isLocalhost = !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl);

    let emailSent = false;
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      console.log('⚠️ Parent verification: SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env (see .env.example for Gmail setup).');
    } else if (isLocalhost) {
      console.log('⚠️ Parent verification: VERIFICATION_BASE_URL is localhost. Set VERIFICATION_BASE_URL to your public backend URL (e.g. https://your-api.railway.app) so the link works when the parent taps it.');
    }
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && verificationUrl && !isLocalhost) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT) || 587,
          secure: env.SMTP_SECURE === 'true',
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
          // Keep transport timeouts tight so the API doesn't "hang" in poor SMTP conditions.
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
        });
        const parentName = [parentData.firstName, parentData.lastName].filter(Boolean).join(' ').trim() || 'Parent';
        await sendMailWithTimeout(transporter, {
          from: env.SMTP_FROM || env.SMTP_USER,
          to: email,
          subject: 'SyncroGate – Verify your parent account',
          text: `Hello ${parentName},\n\nAn administrator has requested that you verify your parent account. Tap the link below to verify and start using the parent dashboard:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not request this, you can ignore this email.\n\n— SyncroGate`,
          html: `<p>Hello ${parentName},</p><p>An administrator has requested that you verify your parent account. Tap the link below to verify and start using the parent dashboard:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p><p>— SyncroGate</p>`,
        }, 3000);
        emailSent = true;
      } catch (mailErr) {
        console.error('Parent verification email send failed:', mailErr.message);
      }
    }

    const verificationUrlFinal = verificationUrl || `${env.APP_BASE_URL || ''}/api/verify-parent?token=${token}`;

    // Best-effort: send push notification to parent that verification link is ready
    try {
      const parentFcm = String(parentData.fcmToken || '').trim();
      if (parentFcm) {
        const parentName = [parentData.firstName, parentData.lastName].filter(Boolean).join(' ').trim() || 'Parent';
        const title = 'Parent verification link sent';
        const body = `An admin sent your verification link. Open SyncroGate and tap "Verify now" to activate your account.`;
        await pushService.sendPush(parentFcm, title, body, {
          type: 'parent_verification_sent',
          parentId,
          email,
          parentName,
        });
      }
    } catch (e) {
      console.warn('Failed to send parent verification push (non-blocking):', e?.message);
    }

    const baseMessage = 'Verification request sent. Parent can now verify from their pending dashboard.';
    res.status(200).json({
      success: true,
      emailSent,
      verificationUrl: verificationUrlFinal,
      message: baseMessage,
    });
  } catch (err) {
    console.error('Error sending parent verification:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification' });
  }
};

/** Student verification: create token and optionally send email. Admin only. */
exports.sendStudentVerificationEmail = async (req, res) => {
  try {
    const studentId = req.body.studentId || req.params.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const studentDoc = await firestore.collection('users').doc(studentId).get();
    if (!studentDoc.exists) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentData = studentDoc.data();
    if (String(studentData.role || '').toLowerCase() !== 'student') {
      return res.status(400).json({ error: 'User is not a student' });
    }

    const email = (studentData.email || '').trim();
    if (!email) {
      return res.status(400).json({ error: 'Student has no email' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await firestore.collection('student_verification_tokens').doc(token).set({
      studentId,
      email,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
    });

    // Save token on student user doc so they can verify in-app even if SMTP fails
    try {
      await firestore.collection('users').doc(studentId).set({
        studentVerificationToken: token,
        studentVerificationTokenCreatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.warn('Failed to store student verification token on user doc (non-blocking):', e?.message);
    }

    const baseUrl = (env.VERIFICATION_BASE_URL || env.APP_BASE_URL || '').replace(/\/$/, '');
    const verificationUrl = baseUrl
      ? `${baseUrl}/api/verify-student?token=${token}`
      : null;
    const isLocalhost = !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl);

    let emailSent = false;
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      console.log('⚠️ Student verification: SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env (see .env.example for Gmail setup).');
    } else if (isLocalhost) {
      console.log('⚠️ Student verification: VERIFICATION_BASE_URL is localhost. Set VERIFICATION_BASE_URL to your public backend URL (e.g. https://your-api.railway.app) so the link works when the student taps it.');
    }
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && verificationUrl && !isLocalhost) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT) || 587,
          secure: env.SMTP_SECURE === 'true',
          auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 5000,
        });
        const studentName = [studentData.firstName, studentData.lastName].filter(Boolean).join(' ').trim() || 'Student';
        await sendMailWithTimeout(transporter, {
          from: env.SMTP_FROM || env.SMTP_USER,
          to: email,
          subject: 'SyncroGate – Verify your student account',
          text: `Hello ${studentName},\n\nAn administrator has requested that you verify your student account. Tap the link below to verify and start using the student dashboard:\n\n${verificationUrl}\n\nThis link expires in 24 hours. If you did not request this, you can ignore this email.\n\n— SyncroGate`,
          html: `<p>Hello ${studentName},</p><p>An administrator has requested that you verify your student account. Tap the link below to verify and start using the student dashboard:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p><p>This link expires in 24 hours. If you did not request this, you can ignore this email.</p><p>— SyncroGate</p>`,
        }, 3000);
        emailSent = true;
      } catch (mailErr) {
        console.error('Student verification email send failed (non-blocking):', mailErr.message);
      }
    }

    const verificationUrlFinal = verificationUrl || `${env.APP_BASE_URL || ''}/api/verify-student?token=${token}`;

    // Best-effort: send push notification to student that verification link is ready
    try {
      const studentFcm = String(studentData.fcmToken || '').trim();
      if (studentFcm) {
        const studentName = [studentData.firstName, studentData.lastName].filter(Boolean).join(' ').trim() || 'Student';
        const title = 'Student verification link sent';
        const body = `An admin sent your verification link. Open SyncroGate and tap the verification link in your pending dashboard to activate your account.`;
        await pushService.sendPush(studentFcm, title, body, {
          type: 'student_verification_sent',
          studentId,
          email,
          studentName,
        });
      }
    } catch (e) {
      console.warn('Failed to send student verification push (non-blocking):', e?.message);
    }

    const baseMessage = 'Verification request sent. Student can now verify from their pending dashboard.';
    res.status(200).json({
      success: true,
      emailSent,
      verificationUrl: verificationUrlFinal,
      message: baseMessage,
    });
  } catch (err) {
    console.error('Error sending student verification:', err);
    res.status(500).json({ error: err.message || 'Failed to send verification' });
  }
};

/** Public: verify parent by token (from email link). No auth required. Returns HTML for browser. */
exports.verifyParentByToken = async (req, res) => {
  const htmlSuccess = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SyncroGate – Verified</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;background:#f9fafb}h1{color:#16a34a;font-size:24px}p{color:#374151;line-height:1.6}.btn{display:inline-block;margin-top:16px;padding:12px 24px;background:#004f89;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}</style></head><body><h1>✓ Account Verified</h1><p>${msg}</p><p>Open the SyncroGate app to use the parent dashboard.</p></body></html>`;
  const htmlError = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SyncroGate – Error</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;background:#f9fafb}h1{color:#dc2626;font-size:24px}p{color:#374151;line-height:1.6}</style></head><body><h1>Verification Failed</h1><p>${msg}</p></body></html>`;

  try {
    const token = (req.query.token || req.body?.token || '').trim();
    const wantsJson = String(req.query.json || '').trim() === '1' || String(req.headers.accept || '').includes('application/json');
    if (!token) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'Token is required' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('Invalid link. Token is missing.'));
    }

    const tokenDoc = await firestore.collection('parent_verification_tokens').doc(token).get();
    if (!tokenDoc.exists) {
      if (wantsJson) return res.status(404).json({ success: false, error: 'Invalid or expired link' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(htmlError('Invalid or expired link. Please request a new verification email from the admin.'));
    }

    const data = tokenDoc.data();
    if (data.used) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'This link has already been used' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('This link has already been used. Your account is already verified.'));
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'This link has expired' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('This link has expired. Please request a new verification email from the admin.'));
    }

    const parentId = data.parentId;
    if (!parentId) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'Invalid token data' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('Invalid token data.'));
    }

    const userRef = firestore.collection('users').doc(parentId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      if (wantsJson) return res.status(404).json({ success: false, error: 'Parent account not found' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(htmlError('Parent account not found.'));
    }

    const parentData = userSnap.data() || {};
    await userRef.update({
      verificationStatus: 'verified',
      isVerify: true,
      parentVerificationToken: null,
      updatedAt: new Date().toISOString(),
    });

    await firestore.collection('parent_verification_tokens').doc(token).update({ used: true });

    // Write admin activity log (push will be sent by backend listener)
    try {
      const activityLogRef = firestore.collection('admin_activity_logs').doc('global');
      const activitySnap = await activityLogRef.get();
      const existing = docExists(activitySnap) ? (Array.isArray(activitySnap.data()?.items) ? activitySnap.data().items : []) : [];
      const parentName = [parentData.firstName, parentData.lastName].filter(Boolean).join(' ').trim() || parentData.email || 'Parent';
      const newItem = {
        id: `parent_verified_${parentId}_${Date.now()}`,
        type: 'parent_verified',
        title: 'Parent Account Verified',
        message: `${parentName} (${parentId}) verified their parent account.`,
        createdAt: new Date().toISOString(),
        status: 'unread',
        parent: { id: parentId, email: parentData.email || '', firstName: parentData.firstName || '', lastName: parentData.lastName || '' },
      };
      await activityLogRef.set({ items: [newItem, ...existing] }, { merge: true });
    } catch (e) {
      console.warn('Failed to write parent_verified activity log (non-blocking):', e?.message);
    }

    if (wantsJson) {
      return res.status(200).json({ success: true, message: 'Your account has been verified. You can now use the parent dashboard.' });
    }
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlSuccess('Your parent account has been verified successfully.'));
  } catch (err) {
    console.error('Error verifying parent by token:', err);
    const wantsJson = String(req.query.json || '').trim() === '1' || String(req.headers.accept || '').includes('application/json');
    if (wantsJson) return res.status(500).json({ success: false, error: err.message || 'Verification failed' });
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(htmlError('Verification failed. Please try again or contact support.'));
  }
};

/** Public: verify student by token (from email link). No auth required. Returns HTML for browser. */
exports.verifyStudentByToken = async (req, res) => {
  const htmlSuccess = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SyncroGate – Verified</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;background:#f9fafb}h1{color:#16a34a;font-size:24px}p{color:#374151;line-height:1.6}</style></head><body><h1>✓ Account Verified</h1><p>${msg}</p><p>Open the SyncroGate app to use the student dashboard.</p></body></html>`;
  const htmlError = (msg) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SyncroGate – Error</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:60px auto;padding:24px;text-align:center;background:#f9fafb}h1{color:#dc2626;font-size:24px}p{color:#374151;line-height:1.6}</style></head><body><h1>Verification Failed</h1><p>${msg}</p></body></html>`;

  try {
    const token = (req.query.token || req.body?.token || '').trim();
    const wantsJson = String(req.query.json || '').trim() === '1' || String(req.headers.accept || '').includes('application/json');
    if (!token) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'Token is required' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('Invalid link. Token is missing.'));
    }

    const tokenDoc = await firestore.collection('student_verification_tokens').doc(token).get();
    if (!tokenDoc.exists) {
      if (wantsJson) return res.status(404).json({ success: false, error: 'Invalid or expired link' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(htmlError('Invalid or expired link. Please request a new verification email from the admin.'));
    }

    const data = tokenDoc.data();
    if (data.used) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'This link has already been used' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('This link has already been used. Your account is already verified.'));
    }

    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'This link has expired' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('This link has expired. Please request a new verification email from the admin.'));
    }

    const studentId = data.studentId;
    if (!studentId) {
      if (wantsJson) return res.status(400).json({ success: false, error: 'Invalid token data' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(htmlError('Invalid token data.'));
    }

    const userRef = firestore.collection('users').doc(studentId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      if (wantsJson) return res.status(404).json({ success: false, error: 'Student account not found' });
      res.setHeader('Content-Type', 'text/html');
      return res.status(404).send(htmlError('Student account not found.'));
    }

    const studentData = userSnap.data() || {};
    const nowIso = new Date().toISOString();
    await userRef.update({
      verificationStatus: 'verified',
      isVerify: true,
      studentVerificationToken: null,
      verifiedAt: nowIso,
      updatedAt: nowIso,
    });

    await firestore.collection('student_verification_tokens').doc(token).update({ used: true });

    // Log admin activity: reuse student_verified type
    try {
      const activityRef = firestore.collection('admin_activity_logs').doc('global');
      const activitySnap = await activityRef.get();
      const items = docExists(activitySnap)
        ? (Array.isArray(activitySnap.data()?.items) ? activitySnap.data().items : [])
        : [];
      const id = `student_verified_${studentId}_${Date.now()}`;
      const studentName = [studentData.firstName, studentData.lastName].filter(Boolean).join(' ').trim() || studentId;
      const newItem = {
        id,
        type: 'student_verified',
        title: 'Student Account Verified',
        message: `Verified student account: ${studentName} (${studentId})`,
        createdAt: nowIso,
        status: 'unread',
        student: {
          id: studentId,
          firstName: studentData.firstName || '',
          lastName: studentData.lastName || '',
          studentId: studentData.studentId || studentId,
        },
      };
      await activityRef.set({ items: [newItem, ...items] }, { merge: true });
    } catch (e) {
      console.warn('Failed to write student_verified activity log (non-blocking):', e?.message);
    }

    if (wantsJson) {
      return res.status(200).json({ success: true, message: 'Your account has been verified. You can now use the student dashboard.' });
    }
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlSuccess('Your student account has been verified successfully.'));
  } catch (err) {
    console.error('Error verifying student by token:', err);
    const wantsJson = String(req.query.json || '').trim() === '1' || String(req.headers.accept || '').includes('application/json');
    if (wantsJson) return res.status(500).json({ success: false, error: err.message || 'Verification failed' });
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(htmlError('Verification failed. Please try again or contact support.'));
  }
};
