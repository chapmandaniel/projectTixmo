import { config } from '../config/environment';
import { logger } from '../config/logger';
import { transporter, emailFrom } from '../config/email';
import {
    approvalCommentEmail,
    approvalDecisionEmail,
    approvalReminderEmail,
    approvalRequestEmail,
    approvalRevisionEmail,
} from '../utils/emailTemplates';

export interface ReviewerInfo {
    email: string;
    name?: string;
    token: string;
}

export interface RequesterInfo {
    firstName: string;
    lastName: string;
    email: string;
}

export interface ApprovalEmailData {
    title: string;
    eventName: string;
    description?: string;
    deadline: Date;
    revisionNumber: number;
    summary?: string;
    approvalId?: string;
}

export interface CommentNotificationRecipient {
    email: string;
    name?: string;
    reviewerToken?: string;
}

const buildClientUrl = (pathname: string, params?: Record<string, string>) => {
    const url = new URL(pathname, config.clientUrl.endsWith('/') ? config.clientUrl : `${config.clientUrl}/`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
    }
    return url.toString();
};

class ApprovalEmailService {
    private buildReviewUrl(token: string) {
        return buildClientUrl(`/review/${token}`);
    }

    private buildDashboardUrl(approvalId?: string) {
        return buildClientUrl('/approvals', approvalId ? { approvalId } : undefined);
    }

    async sendReviewRequest(
        reviewer: ReviewerInfo,
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ): Promise<boolean> {
        try {
            const reviewUrl = this.buildReviewUrl(reviewer.token);
            const emailData = approvalRequestEmail({
                reviewerName: reviewer.name || reviewer.email.split('@')[0],
                requesterName: `${requester.firstName} ${requester.lastName}`.trim(),
                title: approval.title,
                eventName: approval.eventName,
                description: approval.description,
                deadline: approval.deadline.toLocaleString(),
                revisionNumber: approval.revisionNumber,
                reviewUrl,
            });

            await transporter.sendMail({
                from: emailFrom,
                to: reviewer.email,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text,
            });

            return true;
        } catch (error) {
            logger.error(`Failed to send approval request email: ${(error as Error).message}`);
            return false;
        }
    }

    async sendReviewRequestsToAll(
        reviewers: ReviewerInfo[],
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ) {
        for (const reviewer of reviewers) {
            await this.sendReviewRequest(reviewer, requester, approval);
        }
    }

    async sendRevisionNotification(
        reviewers: ReviewerInfo[],
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ) {
        for (const reviewer of reviewers) {
            try {
                const reviewUrl = this.buildReviewUrl(reviewer.token);
                const emailData = approvalRevisionEmail({
                    reviewerName: reviewer.name || reviewer.email.split('@')[0],
                    requesterName: `${requester.firstName} ${requester.lastName}`.trim(),
                    title: approval.title,
                    eventName: approval.eventName,
                    deadline: approval.deadline.toLocaleString(),
                    revisionNumber: approval.revisionNumber,
                    summary: approval.summary,
                    reviewUrl,
                });

                await transporter.sendMail({
                    from: emailFrom,
                    to: reviewer.email,
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                });
            } catch (error) {
                logger.error(`Failed to send revision email to ${reviewer.email}: ${(error as Error).message}`);
            }
        }
    }

    async sendReminder(
        reviewer: ReviewerInfo,
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ) {
        try {
            const reviewUrl = this.buildReviewUrl(reviewer.token);
            const emailData = approvalReminderEmail({
                reviewerName: reviewer.name || reviewer.email.split('@')[0],
                requesterName: `${requester.firstName} ${requester.lastName}`.trim(),
                title: approval.title,
                eventName: approval.eventName,
                deadline: approval.deadline.toLocaleString(),
                revisionNumber: approval.revisionNumber,
                reviewUrl,
            });

            await transporter.sendMail({
                from: emailFrom,
                to: reviewer.email,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text,
            });

            return true;
        } catch (error) {
            logger.error(`Failed to send reminder email to ${reviewer.email}: ${(error as Error).message}`);
            return false;
        }
    }

    async sendDecisionNotification(
        requester: RequesterInfo,
        reviewer: { email: string; name?: string },
        approval: ApprovalEmailData,
        approvalId: string,
        decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'DECLINED',
        note?: string
    ) {
        try {
            const dashboardUrl = this.buildDashboardUrl(approvalId);
            const emailData = approvalDecisionEmail({
                requesterName: requester.firstName,
                reviewerName: reviewer.name || reviewer.email.split('@')[0],
                title: approval.title,
                eventName: approval.eventName,
                revisionNumber: approval.revisionNumber,
                decision,
                note,
                dashboardUrl,
            });

            await transporter.sendMail({
                from: emailFrom,
                to: requester.email,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text,
            });

            return true;
        } catch (error) {
            logger.error(`Failed to send decision email: ${(error as Error).message}`);
            return false;
        }
    }

    async sendCommentNotification(
        recipients: CommentNotificationRecipient[],
        approval: ApprovalEmailData,
        authorName: string,
        comment: string
    ) {
        for (const recipient of recipients) {
            try {
                const actionUrl = recipient.reviewerToken
                    ? this.buildReviewUrl(recipient.reviewerToken)
                    : this.buildDashboardUrl(approval.approvalId);

                const emailData = approvalCommentEmail({
                    title: approval.title,
                    eventName: approval.eventName,
                    revisionNumber: approval.revisionNumber,
                    authorName,
                    comment,
                    actionUrl,
                    actionLabel: recipient.reviewerToken ? 'Open Review' : 'Open Approval',
                });

                await transporter.sendMail({
                    from: emailFrom,
                    to: recipient.email,
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                });
            } catch (error) {
                logger.error(`Failed to send comment notification email to ${recipient.email}: ${(error as Error).message}`);
            }
        }
    }
}

export const approvalEmailService = new ApprovalEmailService();
