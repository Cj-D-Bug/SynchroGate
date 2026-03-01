const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const backendRoot = path.join(__dirname, "../..");
// Load .env from backend folder first, then project root
dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.join(backendRoot, "..", ".env") });

// Debug: Log all environment variables (for troubleshooting)
// Only log in development to reduce noise in production
if (process.env.NODE_ENV !== 'production') {
  console.log("🔍 Debug: Checking environment variables...");
  console.log("🔍 Total env vars:", Object.keys(process.env).length);
  console.log("🔍 All env var names:", Object.keys(process.env).slice(0, 20).join(", "), "...");
}
console.log("🔍 Available env vars (FIREBASE/JWT):", Object.keys(process.env).filter(k => k.includes("FIREBASE") || k.includes("JWT")).join(", ") || "NONE FOUND");
console.log("🔍 FIREBASE_SERVICE_ACCOUNT_JSON exists:", !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
console.log("🔍 FIREBASE_SERVICE_ACCOUNT_JSON length:", process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? process.env.FIREBASE_SERVICE_ACCOUNT_JSON.length : 0);

function required(name) {
  if (!process.env[name]) {
    console.error(`❌ Missing required environment variable: ${name}`);
    console.error('Please set this variable in Railway dashboard → Variables (or in .env for local dev)');
    console.error(`🔍 All env vars starting with FIREBASE:`, Object.keys(process.env).filter(k => k.startsWith("FIREBASE")));
    throw new Error(`Missing required env var: ${name}`);
  }
  return process.env[name];
}

// Resolve Firebase service account: env string, or path to JSON file (for local dev)
function getFirebaseServiceAccountJson() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  }
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (filePath) {
    const resolved = path.isAbsolute(filePath) ? filePath : path.join(backendRoot, filePath);
    if (fs.existsSync(resolved)) {
      console.log("🔍 Loading Firebase service account from file:", resolved);
      return fs.readFileSync(resolved, "utf8");
    }
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_PATH file not found:", resolved);
  }
  console.error("❌ Missing required: set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_SERVICE_ACCOUNT_PATH to a JSON file for local dev)");
  throw new Error("Missing required env var: FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH");
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 8000,

  // Firebase configuration (JSON string, or loaded from file when FIREBASE_SERVICE_ACCOUNT_PATH is set)
  get FIREBASE_SERVICE_ACCOUNT_JSON() {
    return getFirebaseServiceAccountJson();
  },
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
