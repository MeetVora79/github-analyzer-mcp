FROM node:20-alpine

WORKDIR /app

# Install deps first (better layer caching — only reinstalls if package.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the source
COPY . .

ENV MCP_TRANSPORT=http

EXPOSE 3000

CMD ["node", "src/server.js"]