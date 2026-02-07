# Use Node.js 18
FROM node:18-alpine

# Set working directory to backend
WORKDIR /app/backend

# Copy package files first (for better caching)
COPY backend/package*.json ./

# Install ALL dependencies (including devDependencies)
# Clear npm cache to ensure fresh install
RUN npm cache clean --force && npm install --production=false

# Copy the rest of the backend source code
COPY backend/ ./

# Expose port (adjust if your app uses a different port)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

