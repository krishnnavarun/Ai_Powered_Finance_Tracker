import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

dotenv.config();

const app = express();


// Middleware
// Disable helmet's contentSecurityPolicy in development so devtools/extensions
// don't get blocked while developing locally. Enable CSP in production.
const helmetOptions = {};
if (process.env.NODE_ENV !== 'production') {
  helmetOptions.contentSecurityPolicy = false;
}
app.use(helmet(helmetOptions));

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
    // Allow server-to-server and Postman/curl requests.
    if (!origin) return callback(null, true);

    // Keep local development frictionless.
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    const isRenderOrigin = /^https:\/\/[A-Za-z0-9.-]+\.onrender\.com$/i.test(origin);
    if (allowedOrigins.has(origin) || isRenderOrigin) return callback(null, true);

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route for quick sanity check
app.get('/', (req, res) => {
  res.send('Server is running');
});

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-finance-tracker');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    throw err;
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// In production, serve the built client app after API routes so the SPA
// fallback never intercepts requests like /api/auth/login.
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.resolve();
  const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong'
  });
});

export default app;
