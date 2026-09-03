# Open Startup All-in-One — production image for the platform-test deployment.
# Multi-stage build: install + compile in a full Node image, then copy only the
# built output into a slim runtime image (smaller, fewer moving parts to attack).

# ---- Stage 1: build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Install dependencies first so this layer is cached unless package*.json changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build both the client (Vite) and server (esbuild).
COPY . .
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Only production dependencies in the final image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Built server bundle (dist/index.js) + built client (dist/public) + drizzle config
# and shared schema (needed at runtime by drizzle-orm for type/query building).
COPY --from=build /app/dist ./dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

# Uploaded files live here — this directory is replaced by a mounted volume at
# deploy time (see docker-compose.yml) so uploads survive container rebuilds.
RUN mkdir -p /app/uploads

EXPOSE 5000
CMD ["node", "dist/index.js"]
