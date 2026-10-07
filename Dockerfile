FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ fonts-dejavu-core \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN mkdir -p /opt/played \
  && npm run build \
  && cp data/facilities.json /opt/played/facilities.json \
  && chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
