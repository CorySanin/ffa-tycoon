FROM node:18.15.0-alpine3.17 as build

WORKDIR /usr/src/ffa-tycoon

COPY ./package*json ./

RUN npm install

FROM node:18.15.0-alpine3.17

WORKDIR /usr/src/ffa-tycoon

COPY --from=build /usr/src/ffa-tycoon /usr/src/ffa-tycoon

COPY . .

RUN npm run build && npm install --production && \
 mkdir -p storage/archive storage/config storage/db

USER node

EXPOSE 8080
EXPOSE 8081

CMD [ "node", "index.js"]