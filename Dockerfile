FROM node:16-alpine3.12

ARG SOURCE_HASH=unknown
LABEL io.eagle-mqtt.source-hash=$SOURCE_HASH

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY *.js ./

CMD [ "npm", "start" ]
