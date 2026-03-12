FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY . .

# Copy knowledge base files
COPY src/knowledge/ src/knowledge/

# Build
RUN pnpm run build

# Download model files
RUN pnpm run download-files 2>/dev/null || true

CMD ["node", "dist/main.js", "start"]
