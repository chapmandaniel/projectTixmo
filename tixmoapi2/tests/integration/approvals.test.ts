import request from 'supertest';
import app from '../../src/app';
import {
    cleanupTestData,
    createEvent,
    createOrganization,
    createVenue,
    prisma,
    registerUser,
} from '../utils/testUtils';

describe('Creative approvals API', () => {
    let authToken: string;
    let authUserId: string;
    let organizationId: string;
    let eventId: string;

    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        await cleanupTestData();

        const authData = await registerUser(app);
        authToken = authData.accessToken;
        authUserId = authData.user.id;

        const organization = await createOrganization(app, authToken);
        organizationId = organization.id;

        await prisma.user.update({
            where: { id: authUserId },
            data: { organizationId },
        });

        const venue = await createVenue(app, authToken, { organizationId });
        const event = await createEvent(app, authToken, {
            organizationId,
            venueId: venue.id,
            status: 'PUBLISHED',
        });
        eventId = event.id;
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    it('creates a creative approval with initial revision assets and reviewers', async () => {
        const response = await request(app)
            .post('/api/v1/approvals')
            .set('Authorization', `Bearer ${authToken}`)
            .field('eventId', eventId)
            .field('title', 'Main stage LED artwork')
            .field('description', 'Initial static composition for management review.')
            .field('deadline', new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString())
            .field('reviewers', JSON.stringify([{ email: 'manager@example.com' }]))
            .attach('files', Buffer.from('fake-image'), {
                filename: 'artwork.png',
                contentType: 'image/png',
            });

        expect(response.status).toBe(201);
        expect(response.body.title).toBe('Main stage LED artwork');
        expect(response.body.status).toBe('PENDING_REVIEW');
        expect(response.body.latestRevisionNumber).toBe(1);
        expect(response.body.reviewers).toHaveLength(1);
        expect(response.body.latestRevision.assets).toHaveLength(1);
    });

    it('lists approval requests with creative workflow fields', async () => {
        const response = await request(app)
            .get('/api/v1/approvals?status=PENDING_REVIEW')
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.approvals)).toBe(true);
        expect(response.body.approvals[0]).toHaveProperty('latestRevision');
    });

    it('adds a reviewer to an existing approval request', async () => {
        const approval = await prisma.approvalRequest.findFirstOrThrow({
            where: { title: 'Main stage LED artwork' },
        });

        const response = await request(app)
            .post(`/api/v1/approvals/${approval.id}/reviewers`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                reviewers: [{ email: 'second-reviewer@example.com' }],
            });

        expect(response.status).toBe(201);
        expect(response.body.reviewers).toHaveLength(2);
        expect(response.body.reviewers.map((reviewer: { email: string }) => reviewer.email)).toContain(
            'second-reviewer@example.com'
        );
        expect(response.body.status).toBe('PENDING_REVIEW');
    });

    it('resends an invite for an existing reviewer with a fresh secure token', async () => {
        const approval = await prisma.approvalRequest.findFirstOrThrow({
            where: { title: 'Main stage LED artwork' },
            include: { reviewers: true },
        });

        const reviewer = approval.reviewers.find((item) => item.email === 'second-reviewer@example.com');
        expect(reviewer).toBeDefined();

        const previousToken = reviewer?.token;

        const response = await request(app)
            .post(`/api/v1/approvals/${approval.id}/reviewers/${reviewer?.id}/resend`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.reviewers).toHaveLength(2);

        const refreshedReviewer = await prisma.approvalReviewer.findUniqueOrThrow({
            where: { id: reviewer?.id },
        });

        expect(refreshedReviewer.token).not.toBe(previousToken);
    });

    it('removes a pending reviewer who has not interacted yet', async () => {
        const approval = await prisma.approvalRequest.findFirstOrThrow({
            where: { title: 'Main stage LED artwork' },
            include: { reviewers: true },
        });

        const reviewer = approval.reviewers.find((item) => item.email === 'second-reviewer@example.com');
        expect(reviewer).toBeDefined();

        const response = await request(app)
            .delete(`/api/v1/approvals/${approval.id}/reviewers/${reviewer?.id}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.reviewers).toHaveLength(1);
        expect(response.body.reviewers.map((item: { email: string }) => item.email)).not.toContain(
            'second-reviewer@example.com'
        );
    });

    it('supports external review comments and decisions via secure token', async () => {
        const approval = await prisma.approvalRequest.findFirstOrThrow({
            where: { title: 'Main stage LED artwork' },
            include: { reviewers: true },
        });

        const reviewerToken = approval.reviewers[0].token;

        const reviewResponse = await request(app).get(`/api/v1/review/${reviewerToken}`);
        expect(reviewResponse.status).toBe(200);
        expect(reviewResponse.body.approval.latestRevision.revisionNumber).toBe(1);

        const commentResponse = await request(app)
            .post(`/api/v1/review/${reviewerToken}/comments`)
            .send({
                content: 'Please soften the sponsor logo treatment.',
                revisionId: reviewResponse.body.approval.latestRevision.id,
            });
        expect(commentResponse.status).toBe(201);

        const decisionResponse = await request(app)
            .post(`/api/v1/review/${reviewerToken}/decisions`)
            .send({
                decision: 'CHANGES_REQUESTED',
                note: 'Typography hierarchy needs one more pass.',
                revisionId: reviewResponse.body.approval.latestRevision.id,
            });
        expect(decisionResponse.status).toBe(200);

        const refreshedApproval = await request(app)
            .get(`/api/v1/approvals/${approval.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(refreshedApproval.status).toBe(200);
        expect(refreshedApproval.body.status).toBe('CHANGES_REQUESTED');
    });

    it('creates a new revision and updates the dashboard status', async () => {
        const approval = await prisma.approvalRequest.findFirstOrThrow({
            where: { title: 'Main stage LED artwork' },
        });

        const response = await request(app)
            .post(`/api/v1/approvals/${approval.id}/revisions`)
            .set('Authorization', `Bearer ${authToken}`)
            .field('summary', 'Adjusted sponsor lockup and headline spacing.')
            .attach('files', Buffer.from('revised-image'), {
                filename: 'artwork-v2.png',
                contentType: 'image/png',
            });

        expect(response.status).toBe(201);
        expect(response.body.status).toBe('UPDATED');
        expect(response.body.latestRevisionNumber).toBe(2);
        expect(response.body.revisions).toHaveLength(2);
    });

    it('allows an internal assigned reviewer to approve the latest revision', async () => {
        const reviewerAuth = await registerUser(app, {
            email: `internal-reviewer-${Date.now()}@example.com`,
        });

        await prisma.user.update({
            where: { id: reviewerAuth.user.id },
            data: { organizationId },
        });

        const response = await request(app)
            .post('/api/v1/approvals')
            .set('Authorization', `Bearer ${authToken}`)
            .field('eventId', eventId)
            .field('title', 'VIP social teaser')
            .field('deadline', new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString())
            .field('reviewers', JSON.stringify([{ email: reviewerAuth.user.email }]))
            .attach('files', Buffer.from('teaser'), {
                filename: 'teaser.png',
                contentType: 'image/png',
            });

        expect(response.status).toBe(201);

        const decisionResponse = await request(app)
            .post(`/api/v1/approvals/${response.body.id}/decisions`)
            .set('Authorization', `Bearer ${reviewerAuth.accessToken}`)
            .send({
                decision: 'APPROVED',
                revisionId: response.body.latestRevision.id,
            });

        expect(decisionResponse.status).toBe(200);

        const refreshed = await request(app)
            .get(`/api/v1/approvals/${response.body.id}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(refreshed.status).toBe(200);
        expect(refreshed.body.status).toBe('APPROVED');
    });
});
