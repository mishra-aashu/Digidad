// Production server configuration
require('dotenv').config({ path: '../.env' });

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);

// Production environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mfigbwrmcmbipvkwqtsr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maWdid3JtY21iaXB2a3dxdHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODg1MjcsImV4cCI6MjA3NTI2NDUyN30.D7OmCYbHa3XUyqPWG4sxxKORP_jiWW9TqOSECAvazTE';

// Production CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from your deployed frontend and localhost for development
    const allowedOrigins = [
      process.env.CLIENT_URL || 'http://localhost:3000',
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://mfigbwrmcmbipvkwqtsr.supabase.co', // Your Supabase URL
      /^https:\/\/.*\.github\.io$/,
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.railway\.app$/,
      /^https:\/\/.*\.render\.com$/,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
};

// Socket.IO CORS configuration for production
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL || 'http://localhost:3000',
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'https://mfigbwrmcmbipvkwqtsr.supabase.co', // Your Supabase URL
        /^https:\/\/.*\.github\.io$/,
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.railway\.app$/,
        /^https:\/\/.*\.render\.com$/,
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ];

      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"]
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting (basic implementation)
const rateLimit = new Map();
app.use((req, res, next) => {
  const key = req.ip + req.path;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;

  if (!rateLimit.has(key)) {
    rateLimit.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const record = rateLimit.get(key);

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    });
  }

  record.count++;
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: 'production',
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = { app, server, io };