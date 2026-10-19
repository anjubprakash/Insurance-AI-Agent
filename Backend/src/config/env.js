import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/insurance_ai_agent',
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  JWT_SECRET: process.env.JWT_SECRET || 'insurance_ai_super_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Qdrant Vector Store
  QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
  QDRANT_API_KEY: process.env.QDRANT_API_KEY || '',
  QDRANT_COLLECTION_NAME: process.env.QDRANT_COLLECTION_NAME || 'insurance_policy_rules',

  // Groq LLM Inference
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',

  // Local Embeddings Engine
  EMBEDDING_PROVIDER: process.env.EMBEDDING_PROVIDER || 'all-minilm'
};