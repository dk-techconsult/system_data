FROM node:20-alpine

# Add ping tool
RUN apk add --no-cache iputils

WORKDIR /app

COPY package.json .
RUN npm install --verbose

COPY server.js .

EXPOSE 3000
CMD ["node", "server.js"]

