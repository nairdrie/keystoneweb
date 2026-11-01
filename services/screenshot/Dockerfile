# Keystone screenshot service. Build from the repo root:
#   docker build -f services/screenshot/Dockerfile -t keystone-screenshot .
FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
RUN npm init -y >/dev/null && npm install --no-save playwright@1.56.1 tsx@4
COPY lib/v2/screenshot-core.ts lib/v2/screenshot-core.ts
COPY services/screenshot/server.ts services/screenshot/server.ts
ENV PORT=8080
EXPOSE 8080
CMD ["npx", "tsx", "services/screenshot/server.ts"]
