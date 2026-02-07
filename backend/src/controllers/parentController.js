// src/controllers/parentController.js
const { firestore } = require('../config/firebase');

exports.getLinkedStudents = async (req, res) => {
  try {
    const parentId = req.user.id; // Comes from authMiddleware attaching user info

    // Query students where parentId = logged-in parent's id
    const linkedStudentsSnapshot = await firestore.collection('users')
      .where('role', '==', 'student')
      .where('parentId', '==', parentId)
      .get();

    const linkedStudents = [];
    linkedStudentsSnapshot.forEach(doc => {
      const studentData = doc.data();
      linkedStudents.push({
        id: doc.id,
        studentNumber: studentData.studentId,
        grade: studentData.yearLevel,
        section: studentData.section,
        user: {
          name: studentData.firstName + ' ' + studentData.lastName,
          email: studentData.email
        }
      });
    });

    res.json(linkedStudents);
  } catch (err) {
    console.error("Error fetching linked students:", err);
    res.status(500).json({ error: "Failed to fetch linked students" });
  }
};
