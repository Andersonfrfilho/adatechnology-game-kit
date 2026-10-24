# syntax=docker/dockerfile:1
# Build context is the repo root (see railway.json).
FROM node:22-alpine AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PUPPETEER_SKIP_DOWNLOAD=1 \
    CI=1
RUN corepack enable
WORKDIR /app

# Manifests first so the install layer stays cached until dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/game-camera/package.json packages/game-camera/
COPY packages/game-contracts/package.json packages/game-contracts/
COPY packages/game-destruction/package.json packages/game-destruction/
COPY packages/game-destruction-three/package.json packages/game-destruction-three/
COPY packages/game-devtools/package.json packages/game-devtools/
COPY packages/game-floorplan/package.json packages/game-floorplan/
COPY packages/game-floorplan-commercial/package.json packages/game-floorplan-commercial/
COPY packages/game-floorplan-post-apocalyptic/package.json packages/game-floorplan-post-apocalyptic/
COPY packages/game-floorplan-residential/package.json packages/game-floorplan-residential/
COPY packages/game-fluids/package.json packages/game-fluids/
COPY packages/game-fluids-three/package.json packages/game-fluids-three/
COPY packages/game-infection/package.json packages/game-infection/
COPY packages/game-interactables/package.json packages/game-interactables/
COPY packages/game-interactables-household/package.json packages/game-interactables-household/
COPY packages/game-interactables-three/package.json packages/game-interactables-three/
COPY packages/game-props3d/package.json packages/game-props3d/
COPY packages/game-test-room/package.json packages/game-test-room/
COPY packages/game-vegetation/package.json packages/game-vegetation/
COPY packages/game-vegetation-species/package.json packages/game-vegetation-species/
COPY packages/game-vehicles/package.json packages/game-vehicles/
COPY packages/game-vehicles-fleet/package.json packages/game-vehicles-fleet/
COPY packages/game-weapons/package.json packages/game-weapons/
COPY packages/game-weapons-three/package.json packages/game-weapons-three/
COPY tools/golden/package.json tools/golden/
COPY examples/interactables-showroom/package.json examples/interactables-showroom/
COPY examples/interactables-test-area/package.json examples/interactables-test-area/
COPY examples/test-room/package.json examples/test-room/
COPY examples/weapons-test-area/package.json examples/weapons-test-area/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && node site/build-site.mjs

FROM caddy:2.8-alpine
COPY site/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/site/dist /srv
