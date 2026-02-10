import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { ApiError } from '../utils/ApiError';
import prisma from '../config/prisma';

/**
 * Organization-scoped authorization middleware.
 *
 * Ensures the authenticated user belongs to the same organization as the
 * resource they are trying to access.  CUSTOMER users are exempt (they
 * operate on their own resources which are checked elsewhere).
 *
 * Usage patterns:
 *   – `authorizeOrg('body', 'organizationId')`  → reads from req.body
 *   – `authorizeOrg('query', 'organizationId')` → reads from req.query
 *   – `authorizeOrg('event', 'id')`             → looks up event by req.params[field] and checks its orgId
 */
type Source = 'body' | 'query' | 'event';

export const authorizeOrg = (source: Source, field: string) => {
    return async (req: AuthRequest, _res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            // Customers don't need org checks — they access their own resources
            if (req.user.role === 'CUSTOMER') {
                return next();
            }

            const userOrgId = (req.user as any).organizationId;
            if (!userOrgId) {
                throw ApiError.forbidden('User is not associated with an organization');
            }

            let resourceOrgId: string | undefined;

            if (source === 'body') {
                resourceOrgId = req.body?.[field];
            } else if (source === 'query') {
                resourceOrgId = req.query?.[field] as string;
            } else if (source === 'event') {
                // Look up the event from a route param and extract its organizationId
                const eventId = req.params[field];
                if (eventId) {
                    const event = await prisma.event.findUnique({
                        where: { id: eventId },
                        select: { organizationId: true },
                    });
                    if (!event) {
                        throw ApiError.notFound('Event not found');
                    }
                    resourceOrgId = event.organizationId;
                }
            }

            if (resourceOrgId && resourceOrgId !== userOrgId) {
                throw ApiError.forbidden('You do not have access to this organization\'s resources');
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
