FROM node:18-alpine

WORKDIR /app

COPY package.json .
COPY tsconfig.json .

RUN npm install

COPY src/utils ./src/utils
COPY src/types ./src/types
COPY src/mcp-servers/textract ./src/mcp-servers/textract

RUN npx tsc -b  || (echo "TypeScript compilation failed" && ls -R src && exit 1)
RUN ls -R dist || (echo "dist directory missing" && exit 1)

CMD ["node", "app/dist/mcp-servers/textract/index.js"]