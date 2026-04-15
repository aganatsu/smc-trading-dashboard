FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml .npmrc ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy the rest of the app
COPY . .

# Build the frontend
RUN pnpm run build

# Expose the app port
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]
