FROM node:12-alpine

WORKDIR /usr/src/ffa-tycoon

RUN apk add --no-cache python make gcc g++; mkdir -p storage/archive storage/config storage/db

COPY . .

RUN npm install -g gulp #; npm install; gulp

EXPOSE 8080
CMD [ "node", "index.js"]
