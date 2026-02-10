import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/environment';
import { logger } from '../../config/logger';

export class AIService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor() {
        if (!config.geminiApiKey) {
            logger.warn('Gemini API Key is missing. AI features will not work.');
        }
        this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    async generateCreativeContent(prompt: string, weights: {
        vibrancy: number;
        professionalism: number;
        humor: number;
        creativity: number;
    }) {
        try {
            // Construct a detailed system instruction based on weights
            const styleInstruction = `
        You are an elite Social Media Manager AI. Generate a comprehensive content strategy based on the user's prompt.
        Adjust your tone based on these style weights (0-100 scale):
        - Vibrancy (Excitement/Energy): ${weights.vibrancy}
        - Professionalism (Formal/Polished): ${weights.professionalism}
        - Humor (Witty/Fun): ${weights.humor}
        - Creativity (Unique/Abstract): ${weights.creativity}
        
        You must generate content optimized for THREE specific platforms: Instagram, Twitter (X), and LinkedIn.

        Return the response in this EXACT JSON format:
        {
          "platforms": {
            "instagram": {
              "text": "Caption with emojis...",
              "hashtags": ["#tag1", "#tag2", ...]
            },
            "twitter": {
              "text": "Short, punchy tweet (max 280 chars)...",
              "hashtags": ["#tag1", "#tag2"]
            },
            "linkedin": {
              "text": "Professional, longer-form post...",
              "hashtags": ["#tag1", "#tag2", ...]
            }
          },
          "strategy": {
            "viralityScore": 85, // Integer 0-100
            "explanation": "Why this content will perform well..."
          },
          "visuals": {
             "imagePrompt": "Detailed prompt for Midjourney/DALL-E: A cinematic shot of...",
             "previewUrl": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
          }
        }
        (Note: For the previewUrl, select a high-quality, relevant random image URL from Unsplash that matches the content mood. It must be a valid URL string.)
      `;

            const fullPrompt = `${styleInstruction}\n\nUser Prompt: ${prompt}`;

            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();

            // Clean up markdown code blocks if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(text);
        } catch (error) {
            logger.error('Error generating AI content:', error);
            throw new Error('Failed to generate creative content');
        }
    }
}

export const aiService = new AIService();
