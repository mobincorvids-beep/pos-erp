# NOTE: written to standard Docker/Node best practices but never actually
# built or run — this sandbox has no Docker daemon and its network
# allowlist blocks Docker Hub itself (registry-1.docker.io returns
# host_not_allowed), so there was no way to verify this here. Build it
# once locally (`docker build -t pos-erp-api .`) before relying on it.

FROM node:20-alpine AS deps
WORKDIR /app
# Copy only the manifest first so this layer is cached and skipped on
# every rebuild that doesn't touch dependencies — the single biggest lever
# for fast iterative builds.
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as a non-root user — the "node" user/group ships built into the
# official image for exactly this purpose. Never run an internet-facing
# process as root inside a container if it can be avoided.
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node

EXPOSE 4000

# Matches GET /health in src/server.js — used by docker-compose's
# healthcheck and by any orchestrator that wants to know the container is
# actually serving, not just that the process is alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
