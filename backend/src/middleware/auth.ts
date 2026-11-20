import { getJwtSecret, verifyUserToken, type UserRole } from '../utils/auth';

export const requireAuth = (req: any, res: any, next: any) => {
  const auth = req.headers?.authorization || req.headers?.Authorization as string | undefined;
  const token = auth?.startsWith('Bearer ') ? auth.substring(7) : auth;
  if (!token) return res.status(401).json({ ok: false, message: 'Missing token' });
  try {
    const payload = verifyUserToken(token);
    req.user = { id: payload.id, userId: payload.userId, username: payload.username, provider: payload.provider, role: payload.role || 'user' };
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Invalid token' });
  }
};

export const requireRole = (...roles: UserRole[]) => (req: any, res: any, next: any) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ ok: false, message: 'Insufficient permissions' });
  }
  return next();
};

export default requireAuth;
