FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && update-ca-certificates && npm install --global --ignore-scripts @openai/codex@0.142.5 && mkdir -p /state /opt/harness && chown -R node:node /state /opt/harness
WORKDIR /opt/harness
COPY --chown=node:node bridge.mjs codex-rpc.mjs start.mjs ./
USER node
ENV HOST=0.0.0.0 PORT=8789 HARNESS_STATE_DIR=/state
EXPOSE 8789
VOLUME ["/state"]
CMD ["node", "start.mjs"]
