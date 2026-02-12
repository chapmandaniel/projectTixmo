import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import * as validation from './validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /organizations:
 *   post:
 *     summary: Create a new organization
 *     description: Create a new organization (promoter, venue, or reseller). Requires ADMIN or PROMOTER role.
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Awesome Events Co"
 *               slug:
 *                 type: string
 *                 example: "awesome-events"
 *                 description: "URL-friendly identifier (lowercase, numbers, hyphens only)"
 *               type:
 *                 type: string
 *                 enum: [PROMOTER, VENUE, RESELLER]
 *                 example: PROMOTER
 *     responses:
 *       201:
 *         description: Organization created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires ADMIN or PROMOTER role
 *       409:
 *         description: Organization with this slug already exists
 */
router.post(
  '/',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.createOrganizationSchema),
  controller.createOrganization
);

/**
 * @swagger
 * /organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     description: Get detailed information about an organization including members and stats
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Organization retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organization not found
 */
router.get('/:id', controller.getOrganization);

/**
 * @swagger
 * /organizations/{id}:
 *   put:
 *     summary: Update organization
 *     description: Update organization details. Must be admin or organization member.
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Events Co"
 *               slug:
 *                 type: string
 *                 example: "updated-events"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, PENDING]
 *                 example: ACTIVE
 *               stripeAccountId:
 *                 type: string
 *                 example: "acct_123456789"
 *     responses:
 *       200:
 *         description: Organization updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Slug already exists
 */
router.put(
  '/:id',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.updateOrganizationSchema),
  controller.updateOrganization
);

/**
 * @swagger
 * /organizations/{id}:
 *   delete:
 *     summary: Delete organization
 *     description: Delete an organization (admin only). Cannot delete if organization has events or venues.
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Organization deleted successfully
 *       400:
 *         description: Cannot delete organization with existing events/venues
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Organization not found
 */
router.delete('/:id', authorize('ADMIN'), controller.deleteOrganization);

/**
 * @swagger
 * /organizations:
 *   get:
 *     summary: List all organizations
 *     description: Get a paginated list of organizations with optional filters
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PROMOTER, VENUE, RESELLER]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, PENDING]
 *     responses:
 *       200:
 *         description: Organizations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(validation.listOrganizationsSchema), controller.listOrganizations);

/**
 * @swagger
 * /organizations/{id}/members:
 *   post:
 *     summary: Add member to organization
 *     description: Add a user as a member of the organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Member added successfully
 *       400:
 *         description: User is already a member
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organization or user not found
 */
router.post('/:id/members', validate(validation.addMemberSchema), controller.addMember);

/**
 * @swagger
 * /organizations/{id}/members/{userId}:
 *   delete:
 *     summary: Remove member from organization
 *     description: Remove a user from the organization
 *     tags: [Organizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Member removed successfully
 *       400:
 *         description: User is not a member of this organization
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Organization or user not found
 */
router.delete('/:id/members/:userId', controller.removeMember);

export default router;
import { z } from 'zod';

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Organization name is required'),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    type: z.enum(['PROMOTER', 'VENUE', 'RESELLER']),
  }),
});

export const updateOrganizationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Organization name is required').optional(),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
    stripeAccountId: z.string().optional(),
  }),
});

export const listOrganizationsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    type: z.enum(['PROMOTER', 'VENUE', 'RESELLER']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  }),
});

export const addMemberSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});
