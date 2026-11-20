import jwt from 'jsonwebtoken';

export type UserRole = 'user' | 'moderator' | 'admin';

export interface TokenUser {
  id: string;
  userId: string;
  username: string;
  provider: string;
  role: UserRole;
}

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters');
  }
  return secret;
};

export const signUserToken = (user: Omit<TokenUser, 'role'> & { role: UserRole }) => jwt.sign(
  {
    id: user.id,
    userId: user.userId,
    username: user.username,
    provider: user.provider,
    role: user.role
  },
  getJwtSecret(),
  { expiresIn: '7d' }
);

export const verifyUserToken = (token: string) => jwt.verify(token, getJwtSecret()) as TokenUser;
