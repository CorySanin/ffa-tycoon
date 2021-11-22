FROM node:16-alpine3.13

WORKDIR /usr/src/ffa-tycoon

RUN apk add --no-cache python3 make gcc g++; mkdir -p storage/archive storage/config storage/db

COPY ./package*json ./

RUN npm install

COPY . .

RUN npx gulp

USER node

EXPOSE 8080
EXPOSE 8081
CMD [ "node", "index.js"]
