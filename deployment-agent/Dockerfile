FROM docker:28.5.1-cli@sha256:9190b0613792e658a7783cf14b2d5ace5941bb68ede7276922ea36ee457d76ad AS cli
FROM node:22.20.0-bookworm-slim@sha256:b21fe589dfbe5cc39365d0544b9be3f1f33f55f3c86c87a76ff65a02f8f5848e
COPY --from=cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
WORKDIR /agent
COPY deployment-agent/package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY deployment-agent/ ./
ENV AGENT_DATA_DIR=/state AGENT_HOST=0.0.0.0
EXPOSE 19090
CMD ["node","server.cjs"]
