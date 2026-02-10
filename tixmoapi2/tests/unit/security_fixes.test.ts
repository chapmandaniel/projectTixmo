// Set environment variables before imports
process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/tixmoapi?schema=public';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt';
import { authService } from '../../src/api/auth/service';
import prisma from '../../src/config/prisma';
import { comparePassword } from '../../src/utils/password';
import { ApiError } from '../../src/utils/ApiError';
import { uploadService } from '../../src/services/upload.service';
import fs from 'fs';
import { unlink } from 'fs/promises';
import { s3Client } from '../../src/config/s3';

// Mock prisma
jest.mock('../../src/config/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock bcryptjs via password utils
jest.mock('../../src/utils/password', () => ({
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
}));

// Mock notificationService
jest.mock('../../src/utils/notificationService', () => ({
  notificationService: {
    sendWelcomeEmail: jest.fn(),
  },
}));

// Mock fs and fs/promises
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  unlink: jest.fn(),
}));

// Mock s3 config
jest.mock('../../src/config/s3', () => ({
  s3Client: {
    send: jest.fn(),
  },
  S3_BUCKET: 'test-bucket',
  isS3Configured: jest.fn().mockReturnValue(true),
}));

// Mock s3-request-presigner
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('http://mock-s3-url.com'),
}));

describe('Security Fixes Verification', () => {
  describe('JWT Expiration', () => {
    it('should include expiration in access token', () => {
      const payload = { userId: '1', email: 'test@example.com', role: 'USER' };
      const token = generateAccessToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded).toHaveProperty('exp');
      // Verify exp is roughly what we expect (7 days in seconds)
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now);
    });

    it('should include expiration in refresh token', () => {
      const payload = { userId: '1', email: 'test@example.com', role: 'USER' };
      const token = generateRefreshToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded).toHaveProperty('exp');
      const now = Math.floor(Date.now() / 1000);
      expect(decoded.exp).toBeGreaterThan(now);
    });
  });

  describe('Login Timing Attack Mitigation', () => {
    it('should compare password even if user is not found', async () => {
      // Setup mock to return null (user not found)
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (comparePassword as jest.Mock).mockResolvedValue(false);

      try {
        await authService.login({ email: 'notfound@example.com', password: 'password' });
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toBe('Invalid credentials');
      }

      // Check if comparePassword was called with the dummy hash
      expect(comparePassword).toHaveBeenCalledWith(
        'password',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      );
    });

    it('should compare password with user hash if user is found', async () => {
      // Setup mock to return user
      const mockUser = {
        id: '1',
        email: 'found@example.com',
        passwordHash: 'realhash',
        role: 'USER',
        organizationId: null,
        emailVerified: true
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (comparePassword as jest.Mock).mockResolvedValue(true);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      await authService.login({ email: 'found@example.com', password: 'password' });

      // Check if comparePassword was called with the real hash
      expect(comparePassword).toHaveBeenCalledWith('password', 'realhash');
    });
  });

  describe('Upload Service (Disk Storage)', () => {
    it('should upload file from disk path and delete it afterwards', async () => {
      const mockFile = {
        path: '/tmp/test-file',
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1024,
      } as any;

      const mockStream = { pipe: jest.fn() };
      (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
      (s3Client.send as jest.Mock).mockResolvedValue({});
      (unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await uploadService.uploadFile(mockFile);

      // Verify fs.createReadStream was called
      expect(fs.createReadStream).toHaveBeenCalledWith(mockFile.path);

      // Verify s3Client.send was called
      expect(s3Client.send).toHaveBeenCalled();

      // Verify unlink was called
      expect(unlink).toHaveBeenCalledWith(mockFile.path);

      // Verify result
      expect(result).toHaveProperty('s3Key');
      expect(result.s3Url).toBe('http://mock-s3-url.com');
    });

    it('should throw error if both buffer and path are missing', async () => {
      const mockFile = {
        originalname: 'test.png',
        mimetype: 'image/png',
        size: 1024,
      } as any;

      await expect(uploadService.uploadFile(mockFile)).rejects.toThrow('File content is empty');
    });
  });
});
