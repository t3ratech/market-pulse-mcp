# Stdio build for registry introspection and hosted runtimes. Zero runtime
# dependencies: the image is the package source on a pinned Node base.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY agent-skills ./agent-skills
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "src/server.js"]
