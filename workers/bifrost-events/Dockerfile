FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3 (python3 is usually required/included but build-essential might be needed)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8080

CMD [ "npm", "start" ]
