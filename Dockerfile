# Use Node.js 18
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
WORKDIR /app/backend
RUN npm install --production=false

# Copy backend source code
WORKDIR /app
COPY backend ./backend

# Set working directory back to backend
WORKDIR /app/backend

# Expose port (adjust if needed)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]

