# NOTE: same caveat as the backend Dockerfile — written to best practices,
# never actually built here (no Docker daemon, registry blocked by this
# sandbox's network allowlist). Verify locally before relying on it.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_API_BASE_URL is baked into the static bundle at BUILD time (Vite
# inlines import.meta.env.* at build, not at container runtime) — pass it
# as a build arg, not a runtime environment variable, or it will silently
# have no effect.
ARG VITE_API_BASE_URL=http://localhost:4000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
