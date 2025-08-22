const { Student } = require("../models/mysql");
const qrService = require("../services/qrService"); // Assume you have this service for QR generation

// Get all students (Admin, Developer)
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.findAll();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single student by ID (Admin, Developer, Parent)
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create student (Admin, Developer)
exports.createStudent = async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update student by ID (Admin, Developer)
exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    await student.update(req.body);
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete student by ID (Admin, Developer)
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    await student.destroy();
    res.json({ message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get linked students for a parent (Parent)
exports.getLinkedStudentsForParent = async (req, res) => {
  try {
    const parentId = req.params.parentId;

    // Assuming you have a Student model relation or mapping table that links parents to students.
    // For example, a 'parentId' field in Student, or a join table 'ParentStudent'.
    // Adjust the query based on your actual data model.

    const linkedStudents = await Student.findAll({
      where: { parentId }, // If direct foreign key exists; otherwise do proper join
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

    const student = await Student.findByPk(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Use your qrService to generate QR code data or URL
    const qrCodeUrl = await qrService.generateForStudent(student);

    res.json({ qrCodeUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
