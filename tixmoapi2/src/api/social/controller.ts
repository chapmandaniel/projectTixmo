import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { createRuleKeywordClassifier, normalizeClassification } from '../../social/classifier';
import { readSocialConfig, toPublicSocialConfig } from '../../social/config';
import { listCapturedSocialEmails, requireCaptureReader } from '../../social/email-capture';
import { successResponse } from '../../utils/response';

export const getConfig = (_req: AuthRequest, res: Response): void => {
  res.json(successResponse(toPublicSocialConfig(readSocialConfig())));
};

export const classifyComments = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const body = req.body as { comments?: { id?: string; text?: string }[] } | undefined;
    const comments = Array.isArray(body?.comments) ? body.comments.slice(0, 50) : [];
    const classifier = createRuleKeywordClassifier();
    const classifications = comments.map((comment, index) => {
      const commentId = String(comment?.id || `comment-${index + 1}`);
      return normalizeClassification({
        ...classifier.classify({ id: commentId, text: String(comment?.text || '') }),
        commentId,
      });
    });
    res.json(successResponse({ classifications }));
  } catch (error) {
    next(error);
  }
};

export const listEmailCaptures = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const config = readSocialConfig();
    const organizationId = requireCaptureReader(
      { role: req.user?.role, organizationId: req.user?.organizationId },
      config.enabled
    );
    res.json(successResponse({ captures: listCapturedSocialEmails(organizationId) }));
  } catch (error) {
    next(error);
  }
};
