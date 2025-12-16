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
 * /venues:
 *   post:
 *     summary: Create a new venue
 *     description: Create a new venue for an organization. Requires ADMIN or PROMOTER role.
 *     tags: [Venues]
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
 *               - organizationId
 *               - address
 *               - capacity
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Madison Square Garden"
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *               address:
 *                 type: object
 *                 required:
 *                   - street
 *                   - city
 *                   - state
 *                   - country
 *                   - postalCode
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "4 Pennsylvania Plaza"
 *                   city:
 *                     type: string
 *                     example: "New York"
 *                   state:
 *                     type: string
 *                     example: "NY"
 *                   country:
 *                     type: string
 *                     example: "USA"
 *                   postalCode:
 *                     type: string
 *                     example: "10001"
 *               capacity:
 *                 type: integer
 *                 example: 20000
 *               description:
 *                 type: string
 *                 example: "World-famous arena in Midtown Manhattan"
 *               timezone:
 *                 type: string
 *                 example: "America/New_York"
 *     responses:
 *       201:
 *         description: Venue created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Organization not found
 *       409:
 *         description: Venue with this slug already exists
 */
router.post(
  '/',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.createVenueSchema),
  controller.createVenue
);

/**
 * @swagger
 * /venues/{id}:
 *   get:
 *     summary: Get venue by ID
 *     description: Get detailed information about a venue
 *     tags: [Venues]
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
 *         description: Venue retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Venue not found
 */
router.get('/:id', controller.getVenue);

/**
 * @swagger
 * /venues/{id}:
 *   put:
 *     summary: Update venue
 *     description: Update venue details
 *     tags: [Venues]
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
 *               slug:
 *                 type: string
 *               address:
 *                 type: object
 *               description:
 *                 type: string
 *               timezone:
 *                 type: string
 *               seatingChart:
 *                 type: object
 *     responses:
 *       200:
 *         description: Venue updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Venue not found
 */
router.put(
  '/:id',
  authorize('ADMIN', 'PROMOTER'),
  validate(validation.updateVenueSchema),
  controller.updateVenue
);

/**
 * @swagger
 * /venues/{id}:
 *   delete:
 *     summary: Delete venue
 *     description: Delete a venue (admin only). Cannot delete if venue has events.
 *     tags: [Venues]
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
 *         description: Venue deleted successfully
 *       400:
 *         description: Cannot delete venue with existing events
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Venue not found
 */
router.delete('/:id', authorize('ADMIN'), controller.deleteVenue);

/**
 * @swagger
 * /venues:
 *   get:
 *     summary: List all venues
 *     description: Get a paginated list of venues with optional filters
 *     tags: [Venues]
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
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Venues retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', validate(validation.listVenuesSchema), controller.listVenues);

export default router;
