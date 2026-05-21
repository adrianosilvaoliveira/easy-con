FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
COPY backend/ ./
COPY --from=frontend-builder /app/backend/public ./public
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --only=production

COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/public ./public
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma ./node_modules/@prisma
COPY backend/prisma ./prisma/

RUN mkdir -p logs

EXPOSE 3333

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/server.js"]
