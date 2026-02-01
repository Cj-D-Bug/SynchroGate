const { firestore } = require("../config/firebase");
const qrService = require("../services/qrService");

// Get all students (Admin, Developer)
exports.getAllStudents = async (req, res) => {
  try {
    const studentsSnapshot = await firestore.collection('users')
      .where('role', '==', 'student')
      .get();
    
    const students = [];
    studentsSnapshot.forEach(doc => {
      students.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single student by ID (Admin, Developer, Parent)
exports.getStudentById = async (req, res) => {
  try {
    const studentDoc = await firestore.collection('users').doc(req.params.id).get();
    if (!studentDoc.exists) return res.status(404).json({ message: "Student not found" });
    
    const studentData = studentDoc.data();
    if (studentData.role !== 'student') return res.status(404).json({ message: "Student not found" });
    
    res.json({ id: studentDoc.id, ...studentData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create student (Admin, Developer)
exports.createStudent = async (req, res) => {
  try {
    const studentData = {
      ...req.body,
      role: 'student',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await firestore.collection('users').add(studentData);
    res.status(201).json({ id: docRef.id, ...studentData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update student by ID (Admin, Developer)
exports.updateStudent = async (req, res) => {
  try {
    const studentRef = firestore.collection('users').doc(req.params.id);
    const studentDoc = await studentRef.get();
    
    if (!studentDoc.exists) return res.status(404).json({ message: "Student not found" });
    
    const studentData = studentDoc.data();
    if (studentData.role !== 'student') return res.status(404).json({ message: "Student not found" });
    
    await studentRef.update({
      ...req.body,
      updatedAt: new Date()
    });
    
    const updatedDoc = await studentRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete student by ID (Admin, Developer)
exports.deleteStudent = async (req, res) => {
  try {
    const studentRef = firestore.collection('users').doc(req.params.id);
    const studentDoc = await studentRef.get();
    
    if (!studentDoc.exists) return res.status(404).json({ message: "Student not found" });
    
    const studentData = studentDoc.data();
    if (studentData.role !== 'student') return res.status(404).json({ message: "Student not found" });
    
    await studentRef.delete();
    res.json({ message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get linked students for a parent (Parent)
exports.getLinkedStudentsForParent = async (req, res) => {
  try {
    const parentId = req.params.parentId;
    
    // Get students linked to this parent
    const studentsSnapshot = await firestore.collection('users')
      .where('role', '==', 'student')
      .where('parentId', '==', parentId)
      .get();
    
    const linkedStudents = [];
    studentsSnapshot.forEach(doc => {
      linkedStudents.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(linkedStudents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate QR code for a student (Admin only)
exports.generateStudentQRCode = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ message: "studentId is required" });

    const studentDoc = await firestore.collection('users').doc(studentId).get();
    if (!studentDoc.exists) return res.status(404).json({ message: "Student not found" });
    
    const studentData = studentDoc.data();
    if (studentData.role !== 'student') return res.status(404).json({ message: "Student not found" });

    // Use your qrService to generate QR code data or URL
    const qrCodeUrl = await qrService.generateForStudent({ id: studentId, ...studentData });

    // Persist to student_QRcode collection as source of truth
    await firestore.collection('student_QRcode').doc(String(studentId)).set({
      studentId: String(studentId),
      qrCodeUrl,
      updatedAt: new Date(),
    }, { merge: true });

    // Also mirror to users and students for compatibility
    await firestore.collection('students').doc(String(studentId)).set({ qrCodeUrl, updatedAt: new Date() }, { merge: true });
    await firestore.collection('users').doc(String(studentId)).set({ qrCodeUrl, updatedAt: new Date() }, { merge: true });

    res.json({ qrCodeUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk generate QR codes for multiple students with throttled batched writes (Admin only)
exports.bulkGenerateStudentQRCodes = async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: "studentIds array is required" });
    }

    // Accept either strings (user doc ids) or objects { id: userDocId, studentId }
    const normalized = studentIds.map((it) => {
      if (typeof it === 'string') {
        return { id: String(it), studentId: String(it) };
      }
      return { id: String(it.id), studentId: String(it.studentId || it.id) };
    });
    // Deduplicate by tuple key
    const seen = new Set();
    const unique = [];
    for (const it of normalized) {
      const key = `${it.id}__${it.studentId}`;
      if (!seen.has(key)) { seen.add(key); unique.push(it); }
    }
    const chunkSize = 20;
    let success = 0;
    let failed = 0;
    const results = [];

    for (let start = 0; start < unique.length; start += chunkSize) {
      const slice = unique.slice(start, start + chunkSize);
      const batch = firestore.batch();
      const now = Date.now();
      slice.forEach((entry) => {
        try {
          const userDocId = String(entry.id);
          const studentDocId = String(entry.studentId);
          const value = `${studentDocId}:${now}`;
          const studentsRef = firestore.collection('students').doc(studentDocId);
          const usersRef = firestore.collection('users').doc(userDocId);
          const qrRef = firestore.collection('student_QRcode').doc(studentDocId);
          batch.set(studentsRef, { qrCodeUrl: value, updatedAt: new Date(now) }, { merge: true });
          batch.set(usersRef, { qrCodeUrl: value, updatedAt: new Date(now) }, { merge: true });
          batch.set(qrRef, { studentId: studentDocId, qrCodeUrl: value, updatedAt: new Date(now) }, { merge: true });
        } catch (e) {
          failed += 1;
          results.push({ id: String(entry?.id), studentId: String(entry?.studentId), ok: false, error: String(e?.message || e) });
        }
      });
      // Commit with basic retry on quota
      let attempt = 0;
      let delayMs = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          await batch.commit();
          success += slice.length;
          slice.forEach((entry) => { results.push({ id: String(entry.id), studentId: String(entry.studentId), ok: true }); });
          break;
        } catch (e) {
          const msg = String(e?.message || e);
          const isQuota = msg.includes('resource-exhausted') || msg.includes('Quota');
          attempt += 1;
          if (!isQuota || attempt >= 3) {
            failed += slice.length;
            slice.forEach((entry) => { results.push({ id: String(entry.id), studentId: String(entry.studentId), ok: false, error: "commit_failed" }); });
            break;
          }
          await new Promise(r => setTimeout(r, delayMs));
          delayMs = Math.min(delayMs * 2, 8000);
        }
      }
      // throttle between batches
      await new Promise(r => setTimeout(r, 800));
    }

    return res.json({ success, failed, total: unique.length, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
