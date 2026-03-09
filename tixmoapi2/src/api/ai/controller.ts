import { Request, Response } from 'express';
import { aiService } from './service';
import { logger } from '../../config/logger';
import { z } from 'zod';

export const generateContentSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    weights: z.object({
        vibrancy: z.number().min(0).max(100),
        professionalism: z.number().min(0).max(100),
        humor: z.number().min(0).max(100),
        creativity: z.number().min(0).max(100),
    }),
});

export const analyzeSocialSchema = z.object({
    post: z.object({
        platform: z.string().min(1),
        author: z.string().min(1),
        content: z.string().min(1),
        eventName: z.string().optional(),
        artistName: z.string().optional(),
    }),
    comments: z.array(z.object({
        author: z.string().min(1),
        text: z.string().min(1),
    })).default([]),
});

export class AIController {
    async generate(req: Request, res: Response) {
        try {
            // Validate input
            const { prompt, weights } = generateContentSchema.parse(req.body);

            const result = await aiService.generateCreativeContent(prompt, weights);

            return res.json({
                success: true,
                data: result
            });
        } catch (error) {
            logger.error('AI Controller Error:', error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ success: false, error: error.errors });
            }
            return res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    }

    async analyzeSocial(req: Request, res: Response) {
        try {
            const { post, comments } = analyzeSocialSchema.parse(req.body);
            const result = await aiService.analyzeSocialPost(post, comments);

            return res.json({
                success: true,
                data: result,
            });
        } catch (error) {
            logger.error('AI social analysis error:', error);
            if (error instanceof z.ZodError) {
                return res.status(400).json({ success: false, error: error.errors });
            }
            return res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    }
}

export const aiController = new AIController();
