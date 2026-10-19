import app from './app.js';
import { connectDB } from './config/db.js';
import { initQdrantCollection } from './services/qdrant.service.js';
import { env } from './config/env.js';

const startServer = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Initialize Qdrant Collection (Non-blocking: server still boots even if Docker is starting)
  try {
    await initQdrantCollection();
  } catch (qErr) {
    console.warn(`⚠️ Vector Database initialization notice: ${qErr.message}`);
  }

  // 3. Start Express Server
  const server = app.listen(env.PORT, () => {
    console.log(`🚀 Insurance AI Agent Server is listening on http://localhost:${env.PORT}`);
    console.log(`📡 Health Check available at http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown handling
  process.on('SIGINT', () => {
    console.log('\n🛑 Gracefully shutting down...');
    server.close(() => {
      console.log('Server terminated.');
      process.exit(0);
    });
  });
};

startServer();
