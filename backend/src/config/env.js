const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../../.env") });

function required(name) {
  if (!process.env[name]) {
    console.error(`❌ Missing required environment variable: ${name}`);
    console.error('Please set this variable in Railway dashboard → Variables');
    throw new Error(`Missing required env var: ${name}`);
  }
  return process.env[name];
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 8000,

  // Firebase configuration
  FIREBASE_SERVICE_ACCOUNT_JSON: required("FIREBASE_SERVICE_ACCOUNT_JSON"),
  FIREBASE_DATABASE_URL: required("FIREBASE_DATABASE_URL"),

  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10),

  EXPO_PUSH_KEY: process.env.EXPO_PUSH_KEY || "",
  TWILIO_SID: process.env.TWILIO_SID || "",
  TWILIO_TOKEN: process.env.TWILIO_TOKEN || "",
  TWILIO_FROM: process.env.TWILIO_FROM || "",

  APP_BASE_URL: process.env.APP_BASE_URL || "http://localhost:8000",
};

module.exports = { env };
