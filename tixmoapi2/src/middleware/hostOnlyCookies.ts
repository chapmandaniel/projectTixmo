import { Request, Response, NextFunction } from 'express';

const cookieDomainAttribute = /(?:^|;\s*)domain\s*=/i;

export const assertHostOnlySetCookie = (value: unknown): void => {
  const entries = Array.isArray(value) ? value : [value];
  for (const entry of entries) {
    if (typeof entry === 'string' && cookieDomainAttribute.test(entry)) {
      throw new Error('Set-Cookie must be host-only and must not include a Domain attribute.');
    }
  }
};

const isSetCookie = (name: unknown) =>
  typeof name === 'string' && name.toLowerCase() === 'set-cookie';

// Every response on the app passes through this, not only auth routes.
export const hostOnlyCookieMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  const setHeader = res.setHeader.bind(res);
  const append = res.append.bind(res);

  res.setHeader = ((name, value) => {
    if (isSetCookie(name)) assertHostOnlySetCookie(value);
    return setHeader(name, value);
  }) as typeof res.setHeader;

  res.append = ((name, value) => {
    if (isSetCookie(name)) assertHostOnlySetCookie(value);
    return append(name, value);
  }) as typeof res.append;

  next();
};
