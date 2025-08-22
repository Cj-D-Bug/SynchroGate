// src/models/mysql/Attendance.js
import { DataTypes, Model } from "sequelize";
import sequelize from "../../config/mysql.js";
import Student from "./Student.js";

class Attendance extends Model {}

Attendance.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    studentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    checkIn: { type: DataTypes.DATE, allowNull: true },
    checkOut: { type: DataTypes.DATE, allowNull: true },
    status: { 
      type: DataTypes.ENUM("present", "absent", "late", "excused"), 
      allowNull: false 
    },
  },
  {
    sequelize,
    modelName: "Attendance",
    tableName: "attendances",
    timestamps: true,
  }
);

// Associations
Student.hasMany(Attendance, { foreignKey: "studentId", as: "attendanceRecords" });
Attendance.belongsTo(Student, { foreignKey: "studentId", as: "student" });

export default Attendance;
