import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { ApiError } from './ApiError';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const token = jwt.sign(payload, config.jwtSecret);
  return token;
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const token = jwt.sign(payload, config.jwtRefreshSecret);
  return token;
};

export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.unauthorized('Invalid token');
    }
    throw ApiError.unauthorized('Token verification failed');
  }
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, config.jwtRefreshSecret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.unauthorized('Invalid refresh token');
    }
    throw ApiError.unauthorized('Refresh token verification failed');
  }
};

export const generateTokens = (payload: TokenPayload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};
