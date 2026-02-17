FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN node seed.js
ENV DASHBOARD_PORT=3001
EXPOSE 3001
CMD ["node", "server.js"]
