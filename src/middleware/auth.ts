import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const DEMO_USER_TOKEN = 'demo-sandbox-token';
export const DEMO_USER_UID = 'demo-architect-uid';
export const DEMO_USER_EMAIL = 'alex.rivera@medianforge.io';

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (token === DEMO_USER_TOKEN) {
    req.user = {
      uid: DEMO_USER_UID,
      email: DEMO_USER_EMAIL,
      name: 'Alex Rivera',
    } as unknown as DecodedIdToken;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
