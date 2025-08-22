// src/models/mysql/Student.js
import { DataTypes, Model } from "sequelize";
import sequelize from "../../config/mysql.js";
import User from "./User.js";

class Student extends Model {}

Student.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, // student’s own user account
    parentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true }, // FK to parent user
    studentNumber: { type: DataTypes.STRING(50), unique: true, allowNull: false },
    grade: { type: DataTypes.STRING(20), allowNull: true },
    section: { type: DataTypes.STRING(20), allowNull: true },
    rfidTag: { type: DataTypes.STRING(100), allowNull: true, unique: true },
  },
  {
    sequelize,
    modelName: "Student",
    tableName: "students",
    timestamps: true,
  }
);

// Associations

// Student belongs to their own user account (student role)
Student.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasOne(Student, { foreignKey: "userId", as: "studentProfile" });

// Parent user has many linked students (children)
User.hasMany(Student, { foreignKey: "parentId", as: "linkedStudents" });
Student.belongsTo(User, { foreignKey: "parentId", as: "parent" });

export default Student;
