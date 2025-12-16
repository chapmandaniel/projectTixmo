import express, { Request, Response } from 'express';
import { swaggerSpec } from '../../config/swagger';

const router = express.Router();

/**
 * Serve OpenAPI JSON specification
 * This endpoint provides machine-readable API documentation
 * Perfect for AI agents, code generators, and automated tools
 */
router.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export default router;
