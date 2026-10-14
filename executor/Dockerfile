FROM node:22-bookworm-slim
WORKDIR /opt/relay
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/* && npm ci --omit=dev && npx playwright install --with-deps chromium
COPY browser.mjs browser-client.mjs policy.mjs files.py ./
RUN mkdir -p /workspace && chown node:node /workspace
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright
RUN cp -r /root/.cache/ms-playwright /opt/browsers && chmod -R a+rX /opt/browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
USER 1000:1000
WORKDIR /workspace
CMD ["sleep","infinity"]
