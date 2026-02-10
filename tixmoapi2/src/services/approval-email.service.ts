import { transporter, emailFrom } from '../config/email';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import {
    approvalRequestEmail,
    approvalReminderEmail,
    approvalDecisionEmail,
    approvalRevisionEmail,
} from '../utils/emailTemplates';

export interface ReviewerInfo {
    email: string;
    name?: string;
    token: string;
}

export interface ApprovalEmailData {
    title: string;
    eventName: string;
    description?: string;
    priority: 'STANDARD' | 'URGENT' | 'CRITICAL';
    dueDate?: Date;
    version?: number;
}

export interface RequesterInfo {
    firstName: string;
    lastName: string;
    email: string;
}

class ApprovalEmailService {
    private baseReviewUrl: string;
    private baseDashboardUrl: string;

    constructor() {
        this.baseReviewUrl = `${config.clientUrl}/review`;
        this.baseDashboardUrl = `${config.clientUrl}/approvals`;
    }

    /**
     * Send review request email to a reviewer
     */
    async sendReviewRequest(
        reviewer: ReviewerInfo,
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ): Promise<boolean> {
        try {
            const reviewUrl = `${this.baseReviewUrl}/${reviewer.token}`;

            const emailData = approvalRequestEmail({
                reviewerName: reviewer.name || reviewer.email.split('@')[0],
                requesterName: `${requester.firstName} ${requester.lastName}`,
                title: approval.title,
                eventName: approval.eventName,
                description: approval.description,
                priority: approval.priority,
                dueDate: approval.dueDate?.toLocaleDateString(),
                reviewUrl,
            });

            await transporter.sendMail({
                from: emailFrom,
                to: reviewer.email,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text,
            });

            logger.info(`Review request email sent to ${reviewer.email}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send review request email: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Send reminder email to a reviewer
     */
    async sendReminder(
        reviewer: ReviewerInfo,
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ): Promise<boolean> {
        try {
            const reviewUrl = `${this.baseReviewUrl}/${reviewer.token}`;

            const emailData = approvalReminderEmail({
                reviewerName: reviewer.name || reviewer.email.split('@')[0],
                requesterName: `${requester.firstName} ${requester.lastName}`,
                title: approval.title,
                eventName: approval.eventName,
                dueDate: approval.dueDate?.toLocaleDateString(),
                reviewUrl,
            });

            await transporter.sendMail({
                from: emailFrom,
                to: reviewer.email,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text,
            });

            logger.info(`Reminder email sent to ${reviewer.email}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send reminder email: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Send decision notification to the requester
     */
    async sendDecisionNotification(
        requester: RequesterInfo,
        reviewerInfo: { name?: string; email: string },
        approval: ApprovalEmailData,
        approvalId: string,
        decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
        note?: string
    ): Promise<boolean> {
        try {
            const dashboardUrl = `${this.baseDashboardUrl}/${approvalId}`;

            const emailData = approvalDecisionEmail({
                requesterName: requester.firstName,
                reviewerName: reviewerInfo.name || reviewerInfo.email.split('@')[0],
                title: approval.title,
                eventName: approval.eventName,
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

            logger.info(`Decision notification sent to ${requester.email}`);
            return true;
        } catch (error) {
            logger.error(`Failed to send decision notification: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * Send revision notification to all reviewers
     */
    async sendRevisionNotification(
        reviewers: ReviewerInfo[],
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ): Promise<void> {
        for (const reviewer of reviewers) {
            try {
                const reviewUrl = `${this.baseReviewUrl}/${reviewer.token}`;

                const emailData = approvalRevisionEmail({
                    reviewerName: reviewer.name || reviewer.email.split('@')[0],
                    requesterName: `${requester.firstName} ${requester.lastName}`,
                    title: approval.title,
                    eventName: approval.eventName,
                    version: approval.version || 1,
                    reviewUrl,
                });

                await transporter.sendMail({
                    from: emailFrom,
                    to: reviewer.email,
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                });

                logger.info(`Revision notification sent to ${reviewer.email}`);
            } catch (error) {
                logger.error(`Failed to send revision notification to ${reviewer.email}: ${(error as Error).message}`);
            }
        }
    }

    /**
     * Send review requests to multiple reviewers
     */
    async sendReviewRequestsToAll(
        reviewers: ReviewerInfo[],
        requester: RequesterInfo,
        approval: ApprovalEmailData
    ): Promise<void> {
        for (const reviewer of reviewers) {
            await this.sendReviewRequest(reviewer, requester, approval);
        }
    }
}

export const approvalEmailService = new ApprovalEmailService();
