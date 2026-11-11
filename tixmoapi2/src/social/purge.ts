import prisma from '../config/prisma';
import { commentRetentionDecision } from './retention';
import { emitSocialLog, type SocialLogger } from './log';
import { readSocialConfig } from './config';

/** Tombstone expired comment bodies and handles. Keeps ids and open-issue holds. */
export const purgeExpiredComments = async (input?: {
  organizationId?: string;
  now?: Date;
  logger?: SocialLogger;
}): Promise<{ scanned: number; purged: number }> => {
  const config = readSocialConfig();
  const now = input?.now || new Date();
  const comments = await prisma.socialComment.findMany({
    where: {
      purgedAt: null,
      ...(input?.organizationId ? { organizationId: input.organizationId } : {}),
    },
    include: {
      issueLinks: { include: { issue: { select: { state: true } } } },
    },
    take: 1000,
  });

  let purged = 0;
  for (const comment of comments) {
    const decision = commentRetentionDecision({
      now,
      createdAt: comment.createdTime,
      retentionDays: config.retentionDays,
      issueStates: comment.issueLinks.map((link) => link.issue.state),
    });
    if (decision.keepBodyAndHandle) continue;
    await prisma.socialComment.update({
      where: { id: comment.id },
      data: {
        body: null,
        handle: null,
        purgedAt: now,
      },
    });
    purged += 1;
    emitSocialLog(input?.logger, 'info', 'retention.purge', {
      organizationId: comment.organizationId,
      queryModel: 'SocialComment',
      queryAction: 'purge',
    });
  }
  return { scanned: comments.length, purged };
};
