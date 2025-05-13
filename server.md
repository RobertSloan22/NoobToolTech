import dotenv from 'dotenv';
dotenv.config();

import path from "path";
import { fileURLToPath } from 'url';
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import cors from "cors";
import { Server } from "socket.io";
import helmet from 'helmet';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { specs } from './swagger.js';
import lmStudioRoutes from './routes/lmStudio.routes.js';
import licensePlateRoutes from './routes/licensePlate.routes.js';
import blenderRoutes from './routes/blenderRoutes.js';
import { initializeBlender } from './blender.js';
import authRoutes from "./routes/auth.routes.js";
import researchRoutes from './routes/research.routes.js';
import researchServiceRoutes from './routes/research.service.js';
import researchO3ServiceRoutes from './routes/research.o3.service.js';
import multiagentResearchRoutes from './routes/multiagent-research.routes.js';
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import agentproxyRoutes from "./routes/agentproxy.routes.js"
import agentRoutes from "./routes/agent.routes.js"
import invoiceRoutes from "./routes/invoice.routes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import customerRoutes from './routes/customerRoutes.js';
import dtcRoutes from './routes/dtc.routes.js';
import vehicleRoutes from "./routes/vehicle.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import technicianRoutes from "./routes/technician.routes.js";
import diagramRoutes from './routes/diagram.routes.js';
import diagramGenerateRoutes from './routes/diagram-generate.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import notesRoutes from './routes/notes.routes.js';
import connectToMongoDB from "./db/connectToMongoDB.js";
import { app, server } from "./socket/socket.js";
import searchRoutes from './routes/search.routes.js';
import serperRoutes from './routes/serper.routes.js';
import imageRoutes from './routes/image.routes.js';
import proxyRoutes from './routes/proxy.routes.js';
import forumCrawlerRoutes from './routes/forumCrawler.js';
import localRoutes from './routes/local.routes.js';
import localResearchRoutes from './routes/localResearch.routes.js';
import localresearchServiceRoutes from './routes/localresearch.service.js';
import embeddingsRoutes from './routes/embeddings.routes.js';
import supabaseRoutes from './routes/supabase.routes.js';
import vectorStoreRoutes from './routes/vectorStore.routes.js';
import openaiRoutes from './routes/openai.js';
import turnResponseRoutes from './routes/turnResponse.routes.js';
import functionRoutes from './routes/functions.routes.js';
import responseImageRoutes from './routes/responseImage.routes.js';
import vehicleQuestionsRoutes from './routes/vehicle-questions.routes.js';
import plateToVinRoutes from './routes/plateToVin.js';
import serpRoutes from './routes/serp.routes.js';
import { VectorService } from './services/VectorService.js';
import { MemoryVectorService } from './services/MemoryVectorService.js';
import memoryVectorRoutes from './routes/memoryVector.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.MONGO_DB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1); // Exit if we can't connect to the database
  });

// Define allowed origins (keep your existing list)
const allowedOrigins = [
  // APIs
  'https://us-license-plate-to-vin.p.rapidapi.com',

  // Local development URLs
  'http://127.0.0.1:5501',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3500',
  'http://localhost:3005',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8000',
  'https://dist-buvoyv9rj-robmit2023s-projects.vercel.app/backgrounddashboard',
  // IP addresses
  'http://192.168.56.1:1234',
  'http://192.168.1.124:8000',
  'http://99.37.183.149:5000',
  'http://99.37.183.149:3000',
  'https://99.37.183.149:5000',

  // Production domains - Make sure we have all variations
  'https://noobtoolai.com',
  'http://noobtoolai.com',
  'https://www.noobtoolai.com',
  'http://www.noobtoolai.com',
  'https://noobtoolai.com/backgrounddashboard',

  // Vercel deployment domains
  'https://dist-pc85lqajg-robmit2023s-projects.vercel.app',
  'https://dist-4ibg6nara-robmit2023s-projects.vercel.app',
  'https://dist-u5xg1a2y5-robmit2023s-projects.vercel.app',
  'https://noobtoolai.com',

  // ngrok domains - support all variations
  'https://b8a5-66-42-19-48.ngrok-free.app',
  'https://eliza.ngrok.app',
  'wss://eliza.ngrok.app',
  'http://eliza.ngrok.app',
  'https://eliza.ngrok-free.app',
  'http://eliza.ngrok-free.app',
  'wss://eliza.ngrok-free.app',
  // Wildcard for any ngrok domain
  'https://*.ngrok.app',
  'https://*.ngrok-free.app',
  'wss://*.ngrok.app',
  'wss://*.ngrok-free.app',

  // App protocols
  'app://*',
  'file://*',
  'electron://*'
];

// Single CORS middleware configuration
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or same-origin)
    if (!origin) return callback(null, true);

    // Always allow localhost development
    if (origin === 'http://localhost:5173') {
      return callback(null, origin);
    }

    // Always allow noobtoolai.com (your main domain)
    if (origin === 'https://noobtoolai.com' || origin.endsWith('noobtoolai.com')) {
      return callback(null, origin);
    }

    // Always allow your specific Vercel URLs
    if (origin === 'https://vercel.com/robmit2023s-projects/dist/6SBKCk4Gz7NsVtLijqJEUUMkD9hh' ||
        origin === 'https://dist-robmit2023s-projects.vercel.app' ||
        origin.startsWith('https://dist-robmit2023s-projects.vercel.app/')) {
      return callback(null, origin);
    }

    // Check against allowedOrigins list
    if (allowedOrigins.includes(origin) ||
        origin.includes('vercel.app') ||
        origin.includes('vercel.com/robmit2023s-projects') ||
        origin.includes('ngrok.app') ||
        origin.includes('ngrok-free.app')) {
      return callback(null, origin);
    }

    // For development only - remove this in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`Dev mode: Allowing CORS from ${origin}`);
      return callback(null, origin);
    }

    // Block all other origins in production
    console.log(`CORS blocked: ${origin}`);
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],   
  maxAge: 86400 // 24 hours
}));

// Preflight handling
app.options('*', cors());

// Special handling for OPTIONS requests to eliza endpoint
app.options('/eliza/*', (req, res) => {
  const origin = req.headers.origin;
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

// Parse JSON and URL-encoded data
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Initialize Blender functionality
initializeBlender(app);

// Proxy middleware setup
// Proxy requests to Eliza system
app.use('/eliza', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/eliza': '/' // rewrite path
  },
  // Add these settings:
  timeout: 60000, // Increase timeout to 60 seconds
  proxyTimeout: 60000,
  // Configure larger limits for proxy
  maxBodyLength: 10 * 1024 * 1024, // 10MB max body length
  // Handle CORS headers correctly
  onProxyRes: (proxyRes, req, res) => {
    // Get the origin from the request
    const origin = req.headers.origin;

    // If there's an origin header, ensure proper CORS headers are set
    if (origin) {
      // For preflight OPTIONS requests and regular requests
      proxyRes.headers['Access-Control-Allow-Origin'] = origin;
      proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin';
      proxyRes.headers['Access-Control-Max-Age'] = '86400'; // 24 hours
    }

    console.log('Eliza proxy response to origin:', origin);
  },
  // Better request handling
  onProxyReq: (proxyReq, req, res) => {
    // Add origin header to forwarded request if missing
    if (!proxyReq.getHeader('origin') && req.headers.origin) {
      proxyReq.setHeader('origin', req.headers.origin);
    }

    // Set appropriate content length if possible
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      // Stream body to request
      proxyReq.write(bodyData);
    }

    console.log('Eliza proxy request from origin:', req.headers.origin);
  },
  // Handle connection errors better
  onError: (err, req, res) => {
    console.error('Eliza proxy error:', err);
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
      });
      res.end(JSON.stringify({
        error: "Eliza service is currently unavailable",
        message: err.message,
        code: "SERVICE_UNAVAILABLE"
      }));
    }
  }
}));



// research web socket for fastagent
app.use('/ws', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/ws': '/'
  },
  // Add WebSocket-specific settings
  websocket: true,
  // Increase timeouts
  timeout: 60000,
  proxyTimeout: 60000,
  // Handle WebSocket-specific events
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    // Log WebSocket connection attempts
    console.log(`WebSocket connection attempt from ${req.headers.origin || 'unknown origin'}`);
    
    // Set appropriate headers for WebSocket
    if (req.headers.origin) {
      proxyReq.setHeader('Origin', req.headers.origin);
    }
    
    // Set authentication headers if available
    const token = req.url.includes('token=') 
      ? new URL(`http://localhost${req.url}`).searchParams.get('token')
      : null;
      
    if (token) {
      proxyReq.setHeader('Authorization', `Bearer ${token}`);
    }
  },
  // Better error logging for WebSocket connections
  onError: (err, req, res) => {
    console.error('WebSocket proxy error:', err.message || err);
    
    // Check if this is a WebSocket upgrade request
    const isWebSocketRequest = req.headers.upgrade && 
      req.headers.upgrade.toLowerCase() === 'websocket';
      
    if (isWebSocketRequest) {
      // WebSocket errors can't use normal response methods
      console.error(`WebSocket connection failed: ${err.message || 'Unknown error'}`);
      // Socket will be closed automatically on error
      return;
    }
    
    // Handle HTTP requests with proper error response
    if (res && res.writeHead && !res.headersSent) {
      // Set CORS headers for error responses too
      const origin = req.headers.origin || '*';
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true'
      });
      res.end(JSON.stringify({
        error: "WebSocket service is currently unavailable",
        message: err.message || 'Connection error',
        code: "WEBSOCKET_UNAVAILABLE"
      }));
    }
  }
}));

// Add research WebSocket proxy route
app.use('/research-ws', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/research-ws': '/'
  },
  onError: (err, req, res) => {
    console.error('Research WebSocket proxy error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Research WebSocket service is currently unavailable");
    }
  }
}));

// Data Analysis endpoint for installing dependencies
app.use('/install-data-analysis-deps', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  pathRewrite: {
    '^/install-data-analysis-deps': '/install-data-analysis-deps'
  },
  onError: (err, req, res) => {
    console.error('Data analysis dependency installation error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Data analysis server is currently unavailable");
    }
  }
}));

// Research and Data Analysis REST API endpoints
app.use('/research', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Research API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Research service is currently unavailable");
    }
  }
}));

app.use('/upload', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Upload API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Upload service is currently unavailable");
    }
  }
}));

app.use('/analysis', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Analysis API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Analysis service is currently unavailable");
    }
  }
}));

app.use('/visualization', createProxyMiddleware({
  target: 'http://localhost:8001',
  changeOrigin: true,
  onError: (err, req, res) => {
    console.error('Visualization API error:', err);
    if (res.writeHead && !res.headersSent) {
      res.writeHead(502);
      res.end("Visualization service is currently unavailable");
    }
  }
}));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/research", researchServiceRoutes);
app.use("/api/research/o3", researchO3ServiceRoutes);
app.use("/api/multiagent-research", multiagentResearchRoutes);
app.use("/api/agentproxy", agentproxyRoutes);
app.use("/api/local", localRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/lmStudio', lmStudioRoutes);
app.use(dtcRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use('/api/forum-crawler', forumCrawlerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/parts", partsRoutes);
app.use("/api/technicians", technicianRoutes);
app.use('/api/diagram', diagramRoutes);
//app.use('/api', diagramGenerateRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/serper', serperRoutes);
app.use('/api', imageRoutes);
app.use('/api', proxyRoutes);
app.use('/api/researchl', localResearchRoutes);
app.use('/api/rservice', localresearchServiceRoutes);
app.use('/api/embeddings', embeddingsRoutes);
app.use('/api', supabaseRoutes);
app.use('/api/vector-store', vectorStoreRoutes);
app.use('/api/openai', openaiRoutes);
app.use('/api/v1/responses', turnResponseRoutes);
app.use('/api/functions', functionRoutes);
app.use('/api', responseImageRoutes);
app.use("/api/vehicle-questions", vehicleQuestionsRoutes);
app.use('/api/license-plate', licensePlateRoutes);
app.use('/api/plate-to-vin', plateToVinRoutes);
app.use('/api/serp', serpRoutes);
app.use('/api/memory-vector', memoryVectorRoutes);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  customSiteTitle: "Automotive AI Platform API Documentation",
  customfavIcon: "/favicon.ico",
  customCss: '.swagger-ui .topbar { display: none }'
}));

// Base URL route
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Automotive AI Platform</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
        .container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 10px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-width: 600px;
          margin: 1rem;
        }
        h1 {
          color: #2c3e50;
          margin-bottom: 1rem;
        }
        p {
          color: #34495e;
          line-height: 1.6;
        }
        .logo {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          color: #3498db;
        }
        .info {
          text-align: left;
          margin-top: 1.5rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 5px;
        }
        .route {
          font-family: monospace;
          background: #eee;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">🚗</div>
        <h1>Automotive AI Platform</h1>
        <p>Welcome to the Automotive AI Platform API the tool for noobs. This is the backend service for our automotive intelligence system.</p>

        <div class="info">
          <h3>Available Proxy Routes:</h3>
          <ul>
            <li><span class="route">/api/*</span> - Main backend services</li>
            <li><span class="route">/eliza</span> - Eliza chat system</li>
            <li><span class="route">/ws</span> - WebSocket server</li>
            <li><span class="route">/research-ws</span> - Research WebSocket server</li>
            <li><span class="route">/research</span> - Research REST API</li>
            <li><span class="route">/upload</span> - File upload for analysis</li>
            <li><span class="route">/analysis</span> - Data analysis API</li>
            <li><span class="route">/visualization</span> - Visualization API</li>
            <li><span class="route">/install-data-analysis-deps</span> - Install data analysis dependencies</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API error handling with CORS headers
app.use('/api', (err, req, res, next) => {
  console.error('API error:', err);

  // Make sure CORS headers are set even on error responses
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.includes('vercel.app'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
} else {
  app.get("*", (req, res) => {
    // Set CORS headers even on 404 responses
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || origin.includes('vercel.app'))) {        
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    res.status(404).json({ message: "API endpoint not found" });
  });
}

// Initialize VectorService
async function initializeServices() {
  try {
    console.log('Initializing Vector Services...');

    // Initialize persistent vector storage
    await VectorService.initialize({
      useLocal: process.env.USE_LOCAL_STORAGE !== 'false',
      useOpenAI: process.env.USE_OPENAI_STORAGE === 'true',
      useDualStorage: process.env.USE_DUAL_STORAGE === 'true',
      chromaUrl: process.env.CHROMA_URL,
      localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
      openaiApiKey: process.env.OPENAI_API_KEY
    });
    console.log('Persistent Vector Service initialized successfully');

    // Initialize memory vector storage
    // Create default instance
    await MemoryVectorService.initialize('default', {
      localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
      useOpenAI: false // Default to local embeddings for memory store
    });

    // Create a session-specific instance for temporary user interactions
    await MemoryVectorService.initialize('user_sessions', {
      localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
      useOpenAI: false
    });

    // Create a forum-crawler instance for temporary forum crawling
    await MemoryVectorService.initialize('forum_crawler', {
      localEmbeddingUrl: process.env.LOCAL_EMBEDDING_URL,
      useOpenAI: false
    });

    console.log('Memory Vector Service initialized successfully');
  } catch (error) {
    console.error('Error initializing Vector Services:', error);
    // Don't exit - the server should still start, but vector services might be limited        
  }
}

// Start the server
server.listen(PORT, async () => {
  console.log(`Server Running on port ${PORT}`);
  await initializeServices();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;