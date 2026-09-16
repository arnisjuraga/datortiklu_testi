FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY public ./public
COPY data ./data

ENV PORT=3000
ENV DB_DIR=/app/data-store
VOLUME ["/app/data-store"]

EXPOSE 3000
CMD ["node", "server/index.js"]
