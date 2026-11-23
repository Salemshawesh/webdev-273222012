FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/campus.sqlite
USER node
EXPOSE 3000
CMD ["npm", "start"]
