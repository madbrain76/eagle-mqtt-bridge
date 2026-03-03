FROM node:16-alpine3.12

ARG SOURCE_HASH=unknown
LABEL io.eagle-mqtt.source-hash=$SOURCE_HASH

WORKDIR /app
COPY *.js* ./
RUN npm ci

CMD [ "npm", "start" ]
