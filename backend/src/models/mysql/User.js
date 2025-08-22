// src/models/mysql/User.js
import { DataTypes, Model } from "sequelize";
import sequelize from "../../config/mysql.js";

class User extends Model {}

User.init(
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { 
      type: DataTypes.ENUM("admin", "student", "parent", "developer"), 
      allowNull: false,
      defaultValue: "student" 
    },
    phone: { type: DataTypes.STRING(20), allowNull: true },
    status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    timestamps: true,
  }
);

export default User;
