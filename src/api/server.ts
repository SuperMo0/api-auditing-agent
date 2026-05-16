import express from 'express';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import { TransactionSchema } from './schemas/transaction.js';
import transactionsRouter from './routes/transactions.js';

const registry = new OpenAPIRegistry();

registry.registerPath({
  method: 'post',
  path: '/api/v1/transactions',
  summary: 'Submit a financial transaction',
  request: {
    body: {
      content: { 'application/json': { schema: TransactionSchema } },
      required: true,
    },
  },
  responses: {
    201: { description: 'Transaction accepted' },
    400: { description: 'Validation failure' },
  },
});

function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: { title: 'Transaction API', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
  });
}

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/docs.json', (_req, res) => {
    res.json(generateOpenApiSpec());
  });

  app.use('/api/v1/transactions', transactionsRouter);

  return app;
}
