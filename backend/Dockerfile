FROM node:20-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY dist ./dist

RUN mkdir -p /app/uploads /app/logs && chown -R node:node /app/uploads /app/logs

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r)=>process.exit(r.statusCode===200?0:1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
