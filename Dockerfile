FROM node:18-alpine

# Install shadow package for usermod/groupmod support, su-exec, tzdata, and postgresql-client
RUN apk add --no-cache shadow su-exec tzdata postgresql-client

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy server and static files
COPY server.js ./
COPY logger.js ./
COPY auth.js ./
COPY privileges.js ./
COPY passport-config.js ./
COPY database/ ./database/
COPY migrations/ ./migrations/
COPY public/ ./public/

# Create entrypoint script to handle PUID, PGID, and UMASK
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory
RUN mkdir -p /data

# Create logs directory
RUN mkdir -p /data/logs

# Expose port
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
