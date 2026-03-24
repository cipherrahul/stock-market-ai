# Build stage
FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production
RUN npm install -g npm@latest

COPY package.json package-lock.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
