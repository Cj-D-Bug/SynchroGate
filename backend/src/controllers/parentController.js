// src/controllers/parentController.js
import Student from '../models/mysql/Student.js';
import User from '../models/mysql/User.js';

export const getLinkedStudents = async (req, res) => {
  try {
    const parentId = req.user.id; // Comes from authMiddleware attaching user info

    // Query students where parentId = logged-in parent's id,
    // including associated User to get the student's name
    const linkedStudents = await Student.findAll({
      where: { parentId },
      attributes: ['id', 'studentNumber', 'grade', 'section'],  // fields from Student
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email'],  // fields from User model
        },
      ],
    });

    res.json(linkedStudents);
  } catch (err) {
    console.error("Error fetching linked students:", err);
    res.status(500).json({ error: "Failed to fetch linked students" });
  }
};
