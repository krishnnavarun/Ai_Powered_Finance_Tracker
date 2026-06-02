import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  // extract scheme + token from Authorization header
  // 401 if scheme !== 'Bearer' or token missing

  // try:
  //   throw if JWT_SECRET not configured
  //   jwt.verify(token, JWT_SECRET) → set req.userId = decoded.id → next()
  // catch → 401: { success: false, message: 'Not authorized to access this route' }
};