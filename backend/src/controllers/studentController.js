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

    res.json({ qrCodeUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
