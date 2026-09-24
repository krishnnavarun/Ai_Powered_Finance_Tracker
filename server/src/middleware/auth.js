import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';

// Requires "Authorization: Bearer <access token>" and sets req.user = { id }.
// Every user-owned query must then filter by req.user.id.
export function requireAuth(req, _res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Please log in to continue');
  }
  req.user = { id: verifyAccessToken(token) };
  next();
}
