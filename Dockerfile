FROM node:lts-alpine AS base

FROM base AS build

WORKDIR /usr/src/ffa-tycoon

RUN apk add --no-cache curl libwebp libwebp-tools libavif-apps

COPY ./package*json ./

RUN npm install

COPY . .

ENV CWEBPTIMEOUT=360000

RUN npm run pixi && npm run build && \
 mkdir -p storage/archive storage/config storage/db && npm install --omit=dev

FROM base AS deploy

HEALTHCHECK  --timeout=3s \
  CMD curl --fail http://localhost:8080/api/healthcheck || exit 1

WORKDIR /usr/src/ffa-tycoon

COPY --from=build /usr/src/ffa-tycoon /usr/src/ffa-tycoon

RUN apk add --no-cache curl

USER node

EXPOSE 8080
EXPOSE 8081

CMD [ "node", "--experimental-strip-types", "src/index.ts"]
