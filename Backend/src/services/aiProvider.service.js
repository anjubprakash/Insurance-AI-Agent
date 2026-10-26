import Groq from "groq-sdk";
import { env } from "../config/env.js";

// Groq SDK Client Factory (returns null if no API key is configured)
export const getGroqClient = () => {
  if (env.GROQ_API_KEY) {
    return new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return null;
};

// Local Xenova/all-MiniLM-L6-v2 Embedding Engine (384-dim ONNX)
class LocalMiniLMEmbeddings {
  //constructor only once its loaded runned then save for the rest of teh system 
  constructor() {
    this.pipelinePromise = null;
  }
  //this allow the model called and loaded onto memoryonce so how many llm calla r gone the modle will work
  async getExtractor() {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const { pipeline } = await import("@huggingface/transformers");
        return pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
          dtype: "q8",
        });
      })();
    }
    return this.pipelinePromise;
  }

  async embedQuery(text) {
    const extractor = await this.getExtractor();
    const cleanText = (text || "").slice(0, 1000); // truncate the test
    const output = await extractor(cleanText, {
      // When text passes through the ONNX model, it outputs a vector for every single token (e.g., a matrix of 256 tokens × 384 numbers). You cannot easily compare a 256-row matrix to another document.
      //Mean Pooling takes the mathematical average of all token vectors, squashing them down into a single, clean 1D array of numbers
      //so this mean pooling help
      pooling: "mean",
      normalize: true,
      truncation: true,
      max_length: 256, // max token limit for the model
    });
    const list = output.tolist();
    return list[0];
  }

  async embedDocuments(documents) {
    const embeddings = [];
    const extractor = await this.getExtractor();
    const BATCH_SIZE = 32;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      const rawBatch = documents.slice(i, i + BATCH_SIZE);
      const batch = rawBatch.map((d) => (d || "").slice(0, 1000));
      const output = await extractor(batch, {
        pooling: "mean",
        normalize: true,
        truncation: true,
        max_length: 256,
      });
      const batchVectors = output.tolist();
      embeddings.push(...batchVectors);
      await new Promise((resolve) => setImmediate(resolve));
    }

    return embeddings;
  }
}

let cachedEmbedder = null;

// Ensures only one instance of the LocalMiniLMEmbeddings class is created and reused throughout your application lifecycle (cachedEmbedder).
export const getEmbeddingModel = () => {
  if (cachedEmbedder) return cachedEmbedder;
  cachedEmbedder = new LocalMiniLMEmbeddings();
  return cachedEmbedder;
};
