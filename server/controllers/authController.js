import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { summarizeTransactions } from '../services/financeAnalyzer.js';

const generateToken = (id) => {
  // throw if JWT_SECRET not configured
  // return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRE || '7d' })
};

const sanitizeUser = (user) => ({
  // return { id, name, email } from user
});

export const signup = async (req, res) => {
  // extract { name, email, password } from req.body, normalize email
  // 400 if name/email/password missing
  // 400 if email already exists
  // create user → generateToken
  // 201: { success, message, token, user: sanitizeUser }
  // catch → 500: { success: false, message }
};

export const login = async (req, res) => {
  // extract { email, password }, normalize email
  // 400 if email/password missing
  // find user with +password → 401 if not found or password mismatch
  // generateToken
  // 200: { success, message, token, user: sanitizeUser }
  // catch → 500: { success: false, message }
};

export const getMe = async (req, res) => {
  // find user by req.userId → 404 if not found
  // 200: { success, user: sanitizeUser }
  // catch → 500: { success: false, message }
};

export const updateProfile = async (req, res) => {
  // extract { name, email }, normalize email
  // 400 if name/email missing
  // 400 if email already taken by another user
  // findByIdAndUpdate req.userId with { name, email, updatedAt }
  // 200: { success, message, user: sanitizeUser, data: sanitizeUser }
  // catch → 500: { success: false, message }
};

export const changePassword = async (req, res) => {
  // extract { currentPassword, newPassword }
  // 400 if missing or newPassword < 6 chars
  // find user with +password → 401 if not found or currentPassword mismatch
  // set user.password = newPassword → save
  // 200: { success, message }
  // catch → 500: { success: false, message }
};

export const getAccountStats = async (req, res) => {
  // fetch transactions + budget by req.userId
  // summarizeTransactions(transactions, budget)
  // 200: { success, data: { transactionCount, totalIncome, totalExpense, savings, budgetRemaining } }
  // catch → 500: { success: false, message }
};