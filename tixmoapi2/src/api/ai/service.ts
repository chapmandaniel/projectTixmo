import { config } from '../../config/environment';
import { logger } from '../../config/logger';

interface CreativeWeights {
    vibrancy: number;
    professionalism: number;
    humor: number;
    creativity: number;
}

interface SocialCommentInput {
    author: string;
    text: string;
}

interface SocialPostInput {
    platform: string;
    author: string;
    content: string;
    eventName?: string;
    artistName?: string;
}

interface SocialAnalysisResult {
    sentimentScore: number;
    sentimentLabel: 'positive' | 'neutral' | 'mixed' | 'negative';
    breakdown: {
        positive: number;
        neutral: number;
        negative: number;
    };
    summary: string;
    flagReason: string | null;
    needsAttention: boolean;
    priority: 'low' | 'medium' | 'high';
    keyComments: Array<{
        author: string;
        text: string;
        sentiment: 'positive' | 'neutral' | 'negative';
        requiresResponse: boolean;
        reason: string;
    }>;
    recommendedActions: string[];
}

export class AIService {
    constructor() {
        if (!config.openaiApiKey) {
            logger.warn('OpenAI API Key is missing. AI features will use fallback responses.');
        }
    }

    private async createJsonCompletion<T>(
        systemPrompt: string,
        userPrompt: string,
        fallback: () => T,
    ): Promise<T> {
        if (!config.openaiApiKey) {
            return fallback();
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: config.openaiModel,
                    response_format: { type: 'json_object' },
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: userPrompt,
                        },
                    ],
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`OpenAI request failed: ${response.status} ${errorBody}`);
            }

            const data = await response.json() as {
                choices?: Array<{
                    message?: {
                        content?: string;
                    };
                }>;
            };

            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('OpenAI response did not include content');
            }

            return JSON.parse(content) as T;
        } catch (error) {
            logger.error('OpenAI JSON completion failed, using fallback response:', error);
            return fallback();
        }
    }

    private buildCreativeFallback(prompt: string, weights: CreativeWeights) {
        const concisePrompt = prompt.trim() || 'your event announcement';
        const energyTone = weights.vibrancy >= 70 ? 'high-energy' : 'balanced';
        const professionalTone = weights.professionalism >= 60 ? 'polished' : 'conversational';
        const humorTone = weights.humor >= 50 ? 'lightly playful' : 'straightforward';

        return {
            platforms: {
                instagram: {
                    text: `Lights up for ${concisePrompt}. Expect a ${energyTone}, ${humorTone} caption that turns scrolling into RSVPs.`,
                    hashtags: ['#Tixmo', '#LiveEvent', '#OnSaleNow'],
                },
                twitter: {
                    text: `${concisePrompt} is live. Fast update, clear CTA, and just enough urgency to drive clicks.`,
                    hashtags: ['#Tickets', '#Events'],
                },
                linkedin: {
                    text: `We are launching ${concisePrompt} with a ${professionalTone} message focused on credibility, audience value, and conversion.`,
                    hashtags: ['#EventMarketing', '#AudienceGrowth', '#Brand'],
                },
            },
            strategy: {
                viralityScore: Math.min(96, Math.max(55, Math.round((weights.vibrancy + weights.creativity) / 2))),
                explanation: 'Fallback strategy emphasizes a clear hook, platform-native phrasing, and a direct call to action.',
            },
            visuals: {
                imagePrompt: `Create a ${energyTone}, ${professionalTone} promotional scene for ${concisePrompt} with cinematic lighting and crowd anticipation.`,
                previewUrl: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
            },
        };
    }

    private buildSocialFallback(post: SocialPostInput, comments: SocialCommentInput[]): SocialAnalysisResult {
        const negativeKeywords = ['refund', 'scam', 'late', 'delay', 'parking', 'line', 'wait', 'confused', 'issue', 'problem'];
        const positiveKeywords = ['love', 'great', 'amazing', 'excited', 'hype', 'perfect', 'best', 'fire', 'incredible'];
        const fullText = [post.content, ...comments.map((comment) => comment.text)].join(' ').toLowerCase();

        const negativeHits = negativeKeywords.reduce((count, word) => count + (fullText.includes(word) ? 1 : 0), 0);
        const positiveHits = positiveKeywords.reduce((count, word) => count + (fullText.includes(word) ? 1 : 0), 0);

        let sentimentScore = 62 + (positiveHits * 8) - (negativeHits * 14);
        sentimentScore = Math.max(5, Math.min(96, sentimentScore));

        const sentimentLabel: SocialAnalysisResult['sentimentLabel'] =
            sentimentScore >= 70 ? 'positive' :
                sentimentScore >= 55 ? 'neutral' :
                    sentimentScore >= 40 ? 'mixed' :
                        'negative';

        const negativeShare = Math.min(80, 18 + (negativeHits * 14));
        const positiveShare = Math.min(80, 30 + (positiveHits * 12));
        const neutralShare = Math.max(5, 100 - negativeShare - positiveShare);

        const prioritizedComments: SocialAnalysisResult['keyComments'] = comments.slice(0, 3).map((comment) => {
            const lowered = comment.text.toLowerCase();
            const commentNegative = negativeKeywords.some((word) => lowered.includes(word));
            const commentPositive = positiveKeywords.some((word) => lowered.includes(word));

            return {
                author: comment.author,
                text: comment.text,
                sentiment: commentNegative ? 'negative' : commentPositive ? 'positive' : 'neutral',
                requiresResponse: commentNegative,
                reason: commentNegative ? 'Potential service issue or rumor to address publicly.' : 'Representative audience reaction.',
            };
        });

        const needsAttention = negativeHits >= 2 || sentimentScore < 50 || prioritizedComments.some((comment) => comment.requiresResponse);
        const priority: SocialAnalysisResult['priority'] =
            sentimentScore < 40 || negativeHits >= 3 ? 'high' :
                needsAttention ? 'medium' :
                    'low';

        return {
            sentimentScore,
            sentimentLabel,
            breakdown: {
                positive: positiveShare,
                neutral: neutralShare,
                negative: Math.max(5, 100 - positiveShare - neutralShare),
            },
            summary: needsAttention
                ? 'Audience conversation shows friction that should be addressed before it spreads further.'
                : 'Conversation is generally healthy, with positive intent outweighing actionable concerns.',
            flagReason: needsAttention ? 'Comments indicate confusion, complaints, or rumors that warrant a response.' : null,
            needsAttention,
            priority,
            keyComments: prioritizedComments,
            recommendedActions: needsAttention
                ? [
                    'Post a public clarification in-platform.',
                    'Route operational issues to the event team.',
                    'Monitor follow-up sentiment after the next refresh.',
                ]
                : [
                    'Keep monitoring for sentiment drift.',
                    'Promote high-performing community reactions.',
                ],
        };
    }

    async generateCreativeContent(prompt: string, weights: CreativeWeights) {
        const systemPrompt = [
            'You are an elite social media manager.',
            'Return valid JSON only.',
            'Generate content for instagram, twitter, and linkedin.',
            'Include a strategy object and visuals object.',
        ].join(' ');

        const userPrompt = `
Prompt: ${prompt}
Weights:
- Vibrancy: ${weights.vibrancy}
- Professionalism: ${weights.professionalism}
- Humor: ${weights.humor}
- Creativity: ${weights.creativity}

Return this JSON shape:
{
  "platforms": {
    "instagram": { "text": "string", "hashtags": ["#tag"] },
    "twitter": { "text": "string", "hashtags": ["#tag"] },
    "linkedin": { "text": "string", "hashtags": ["#tag"] }
  },
  "strategy": { "viralityScore": 0, "explanation": "string" },
  "visuals": { "imagePrompt": "string", "previewUrl": "string" }
}
        `.trim();

        return this.createJsonCompletion(systemPrompt, userPrompt, () => this.buildCreativeFallback(prompt, weights));
    }

    async analyzeSocialPost(post: SocialPostInput, comments: SocialCommentInput[]) {
        const systemPrompt = [
            'You are an operations-focused social media analyst for a live events platform.',
            'Return valid JSON only.',
            'Score sentiment, identify whether attention is needed, summarize key comments, and recommend next actions.',
        ].join(' ');

        const userPrompt = JSON.stringify({
            post,
            comments,
            responseShape: {
                sentimentScore: 'number 0-100',
                sentimentLabel: '"positive" | "neutral" | "mixed" | "negative"',
                breakdown: {
                    positive: 'integer percentage',
                    neutral: 'integer percentage',
                    negative: 'integer percentage',
                },
                summary: 'string',
                flagReason: 'string or null',
                needsAttention: 'boolean',
                priority: '"low" | "medium" | "high"',
                keyComments: [
                    {
                        author: 'string',
                        text: 'string',
                        sentiment: '"positive" | "neutral" | "negative"',
                        requiresResponse: 'boolean',
                        reason: 'string',
                    },
                ],
                recommendedActions: ['string'],
            },
        });

        return this.createJsonCompletion(systemPrompt, userPrompt, () => this.buildSocialFallback(post, comments));
    }
}

export const aiService = new AIService();
