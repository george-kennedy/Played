FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
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

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
