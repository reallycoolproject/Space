declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      userId: string;
      username: string;
      provider: string;
      role: 'user' | 'moderator' | 'admin';
    };
  }
}
