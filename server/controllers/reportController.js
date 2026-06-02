import PDFDocument from 'pdfkit'
import Transaction from '../models/Transaction.js'
import Budget from '../models/Budget.js'
import { summarizeTransactions } from '../services/financeAnalyzer.js'

const formatCurrency = value => {
  // Return INR currency formatted using en-IN locale
}

export const getMonthlyReport = async (req, res) => {
  // parse year + month from req.query (fallback to current)
  // build start + end dates

  // fetch transactions by req.userId within date range
  // sort by transactionDate desc

  // fetch budget for selected month

  // summarizeTransactions(transactions, budget)

  // build report object:
  // {
  //   period,
  //   totalIncome,
  //   totalExpense,
  //   savings,
  //   budgetRemaining,
  //   categoryBreakdown,
  //   monthlyTrend,
  //   transactions
  // }

  // if req.query.format === 'pdf':
  //   set Content-Type + Content-Disposition headers

  //   pipe PDFDocument → res

  //   write:
  //   - title
  //   - period
  //   - summary fields
  //   - category breakdown
  //   - transactions list

  //   limit transactions to first 40 entries

  //   end PDF document and return response

  // return success response with report data

  // catch errors → return 500 response
}