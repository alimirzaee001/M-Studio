import { Request, Response, NextFunction } from 'express';

/**
 * Stub admin auth middleware.
 * Replace with real JWT/API-key validation when auth is implemented.
 */
export function requireAdmin(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
