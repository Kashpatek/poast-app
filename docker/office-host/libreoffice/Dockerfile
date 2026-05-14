FROM node:20-bookworm-slim

# Install LibreOffice + Java for headless conversions.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice \
      libreoffice-writer \
      libreoffice-impress \
      libreoffice-calc \
      default-jre-headless \
      fonts-liberation \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]
