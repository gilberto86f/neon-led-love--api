import express from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { captureRawBody } from './middlewares/stripeRawBody';
import { swaggerSpec } from './swagger';

export const createApp = () => {
  const app = express();

  app.use(cors());
  // `verify` keeps the untouched request bytes for the Stripe webhook only.
  // Stripe signs the raw payload, so verifying against a re-serialised body
  // would fail — see src/middlewares/stripeRawBody.ts.
  app.use(express.json({ verify: captureRawBody }));
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: 1, status: 200, data: { ok: true } });
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
