import { ApiError } from '../utils/apiError.js';
import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Enforce valid JWT token for authenticated routes
export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token missing or invalid');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('User account is inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.unauthorized('Invalid or expired authentication token');
  }
});

// Restrict access to specific roles (e.g. COMPANY_ADMIN, ADMIN, EMPLOYEE)
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Requires one of roles: [${roles.join(', ')}]`
        )
      );
    }
    next();
  };
};
