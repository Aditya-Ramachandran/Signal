FROM mcr.microsoft.com/playwright:v1.58.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY fixtures ./fixtures

ENV NODE_ENV=production
CMD ["npm", "run", "run"]
