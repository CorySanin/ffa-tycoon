FROM node:18-alpine3.18 as build

WORKDIR /usr/src/ffa-tycoon

COPY ./package*json ./

RUN npm install

FROM node:18-alpine3.18

HEALTHCHECK  --timeout=3s \
  CMD curl --fail http://localhost:8080/api/healthcheck || exit 1

WORKDIR /usr/src/ffa-tycoon

COPY --from=build /usr/src/ffa-tycoon /usr/src/ffa-tycoon

COPY . .

RUN apk add --no-cache curl && npm run pixi && npm run build && npm install --production && \
 mkdir -p storage/archive storage/config storage/db

USER node

EXPOSE 8080
EXPOSE 8081

CMD [ "node", "index.js"]