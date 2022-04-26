FROM node:16-alpine3.13 as build

WORKDIR /usr/src/ffa-tycoon

RUN apk add --no-cache python3 make gcc g++

COPY ./package*json ./

RUN npm install

FROM node:16-alpine3.13

WORKDIR /usr/src/ffa-tycoon

COPY --from=build /usr/src/ffa-tycoon /usr/src/ffa-tycoon

COPY . .

RUN npm run build && npm install --production && \
 mkdir -p storage/archive storage/config storage/db

 USER node

EXPOSE 8080
EXPOSE 8081

CMD [ "node", "index.js"]