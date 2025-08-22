// src/models/mysql/Schedule.js
import { DataTypes, Model } from "sequelize";
import sequelize from "../../config/mysql.js";

class Schedule extends Model {}

Schedule.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    startTime: { type: DataTypes.DATE, allowNull: false },
    endTime: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: "Schedule",
    tableName: "schedules",
    timestamps: true,
  }
);

export default Schedule;
