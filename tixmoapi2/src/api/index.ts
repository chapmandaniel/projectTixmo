import { Router } from 'express';
import { config } from '../config/environment';
import authRoutes from './auth/routes';
import userRoutes from './users/routes';
import organizationRoutes from './organizations/routes';
import venueRoutes from './venues/routes';
import eventRoutes from './events/routes';
import ticketTypeRoutes from './ticket-types/routes';
import orderRoutes from './orders/routes';
import ticketRoutes from './tickets/routes';
import promoCodeRoutes from './promo-codes/routes';
import scannerRoutes from './scanners/routes';
import notificationRoutes from './notifications/routes';
import analyticsRoutes from './analytics/routes';
import paymentRoutes from './payments/routes';
import docsRoutes from './docs/routes';
import reportsRoutes from './reports/routes';
import waitlistRoutes from './waitlists/routes';
import taskRoutes from './tasks/routes';

const router = Router();

// Version prefix
const versionRouter = Router();

// Health check for API
versionRouter.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'TixMo API is running',
    version: config.apiVersion,
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
versionRouter.use('/auth', authRoutes);
versionRouter.use('/users', userRoutes);
versionRouter.use('/organizations', organizationRoutes);
versionRouter.use('/venues', venueRoutes);
versionRouter.use('/events', eventRoutes);
versionRouter.use('/ticket-types', ticketTypeRoutes);
versionRouter.use('/orders', orderRoutes);
versionRouter.use('/tickets', ticketRoutes);
versionRouter.use('/promo-codes', promoCodeRoutes);
versionRouter.use('/scanners', scannerRoutes);
versionRouter.use('/reports', reportsRoutes);
versionRouter.use('/notifications', notificationRoutes);
versionRouter.use('/analytics', analyticsRoutes);
versionRouter.use('/payments', paymentRoutes);
versionRouter.use('/waitlists', waitlistRoutes);
versionRouter.use('/tasks', taskRoutes);
versionRouter.use('/docs', docsRoutes);

// Mount versioned routes
router.use(`/${config.apiVersion}`, versionRouter);

export default router;
