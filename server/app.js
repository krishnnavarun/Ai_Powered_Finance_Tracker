import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

dotenv.config();

const app = express();

// Security
const helmetOptions = {};

if (process.env.NODE_ENV !== 'production') {
  helmetOptions.contentSecurityPolicy = false;
}

app.use(helmet(helmetOptions));

// CORS
const parseAllowedOrigins = () => {
  const explicitOrigins = [
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.RENDER_EXTERNAL_URL
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(explicitOrigins);
};

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow Postman, curl, server-to-server requests
    if (!origin) return callback(null, true);

    // Allow everything in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    const isRenderOrigin =
      /^https:\/\/[A-Za-z0-9.-]+\.onrender\.com$/i.test(origin);

    if (allowedOrigins.has(origin) || isRenderOrigin) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate Limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root Route
app.get('/', (req, res) => {
  res.send('Server is running');
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'Server is running'
  });
});

// MongoDB Connection
export const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/ai-finance-tracker'
    );

    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong'
  });
});

export default app;