import { Router, Request, Response } from 'express';
import { catchAsync } from '../../utils/catchAsync';
import { successResponse } from '../../utils/response';
import { ApiError } from '../../utils/ApiError';
import { eventService } from './service';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const router = Router();

// ── Validation ──────────────────────────────────────────────

const listPublicEventsSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().max(100).optional().default(20),
        category: z.string().max(100).optional(),
        search: z.string().max(200).optional(),
    }),
});

const getPublicEventSchema = z.object({
    params: z.object({
        slug: z.string().min(1),
    }),
});

// ── Controllers ─────────────────────────────────────────────

/**
 * @swagger
 * /events/public:
 *   get:
 *     summary: List public events
 *     description: Browse published, on-sale, and sold-out events without authentication
 *     tags: [Events]
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
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public events retrieved successfully
 */
router.get(
    '/',
    validate(listPublicEventsSchema),
    catchAsync(async (req: Request, res: Response) => {
        const { page, limit, category, search } = req.query as Record<string, unknown>;
        const result = await eventService.listPublicEvents({
            page: page !== undefined ? Number(page) : undefined,
            limit: limit !== undefined ? Number(limit) : undefined,
            category: category as string | undefined,
            search: search as string | undefined,
        });
        res.json(successResponse(result));
    })
);

/**
 * @swagger
 * /events/public/{slug}:
 *   get:
 *     summary: Get public event by slug
 *     description: Get detailed event information by its public slug, including ticket types and availability
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details retrieved successfully
 *       404:
 *         description: Event not found
 */
router.get(
    '/:slug',
    validate(getPublicEventSchema),
    catchAsync(async (req: Request, res: Response) => {
        const { slug } = req.params;
        const event = await eventService.getPublicEventBySlug(slug);
        if (!event) {
            throw ApiError.notFound('Event not found');
        }
        res.json(successResponse(event));
    })
);

export default router;
