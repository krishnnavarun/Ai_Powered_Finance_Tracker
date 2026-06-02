import Transaction from '../models/Transaction.js';

export const createTransaction = async (req, res) => {
  // extract { type, title, amount, category, paymentMethod, description, transactionDate } from req.body
  // 400 if type/title/category missing or amount <= 0
  // Transaction.create({ userId, type, title, amount, category, paymentMethod, description, transactionDate || now })
  // 201: { success, message, data: transaction }
  // catch → 500: { success: false, message }
};

export const getTransactions = async (req, res) => {
  // extract { page=1, limit=10, category, type, search, sort='latest' } from req.query
  // build query: { userId } + optional category/type filters + search $or (title/category/description)
  // sortMap: latest/oldest → transactionDate, amount_desc/amount_asc → amount
  // find(query).sort().skip((page-1)*limit).limit + countDocuments(query)
  // 200: { success, data: transactions, pagination: { page, limit, total, pages } }
  // catch → 500: { success: false, message }
};

export const updateTransaction = async (req, res) => {
  // extract id from req.params, { type, title, amount, category, paymentMethod, description, transactionDate } from req.body
  // 400 if type provided but not 'income' or 'expense'
  // build update object with only provided fields (trim strings, Number(amount))
  // findOneAndUpdate({ _id: id, userId }) → 404 if not found
  // 200: { success, message, data: transaction }
  // catch → 500: { success: false, message }
};

export const deleteTransaction = async (req, res) => {
  // extract id from req.params
  // findOneAndDelete({ _id: id, userId }) → 404 if not found
  // 200: { success, message }
  // catch → 500: { success: false, message }
};