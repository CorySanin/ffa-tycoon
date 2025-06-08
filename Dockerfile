FROM node:lts-alpine AS base

FROM base AS build

WORKDIR /usr/src/ffa-tycoon

COPY ./package*json ./

RUN npm install

FROM base

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

CMD [ "node", "--experimental-strip-types", "src/index.ts"]
