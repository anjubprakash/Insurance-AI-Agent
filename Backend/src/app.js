import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import policyDocumentRoutes from './routes/policyDocument.routes.js';
import policyOfferRoutes from './routes/policyOffer.routes.js';
import policyDetailRoutes from './routes/policyDetail.routes.js';
import ragAgentRoutes from './routes/ragAgent.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

const app = express();

// Global Middlewares
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Insurance AI Agent API is running healthy',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/policies', policyDetailRoutes);
app.use('/api/policy-documents', policyDocumentRoutes);
app.use('/api/documents', policyDocumentRoutes);
app.use('/api/policy-offers', policyOfferRoutes);
app.use('/api/agent', ragAgentRoutes);
app.use('/api/rag', ragAgentRoutes);

// Centralized Error Handling Middleware (must be after all routes)
app.use(errorHandler);

export default app;
