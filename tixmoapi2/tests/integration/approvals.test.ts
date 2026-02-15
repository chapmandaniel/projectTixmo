import request from 'supertest';
import app from '../../src/app';
import {
    registerUser,
    createOrganization,
    createVenue,
    createEvent,
    cleanupTestData
} from '../utils/testUtils';

describe('Approvals API Integration Tests', () => {
    let authToken: string;
    let testOrg: any;
    let testVenue: any;
    let testEvent: any;
    let createdApprovalId: string;
    let reviewerToken: string;

    beforeAll(async () => {
        // Register user and get token
        const authData = await registerUser(app);
        authToken = authData.accessToken;

        // Create test organization
        testOrg = await createOrganization(app, authToken);

        // Create test venue
        testVenue = await createVenue(app, authToken, { organizationId: testOrg.id });

        // Create test event
        testEvent = await createEvent(app, authToken, {
            organizationId: testOrg.id,
            venueId: testVenue.id
        });
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    describe('POST /api/v1/approvals', () => {
        it('should create a new approval request', async () => {
            const response = await request(app)
                .post('/api/v1/approvals')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    eventId: testEvent.id,
                    title: 'Test Approval Request',
                    description: 'Test description',
                    priority: 'STANDARD',
                });

            expect(response.status).toBe(201);
            expect(response.body.id).toBeDefined();
            expect(response.body.title).toBe('Test Approval Request');
            expect(response.body.status).toBe('DRAFT');

            createdApprovalId = response.body.id;
        });

        it('should fail without authentication', async () => {
            const response = await request(app)
                .post('/api/v1/approvals')
                .send({
                    eventId: testEvent.id,
                    title: 'Test',
                });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/v1/approvals', () => {
        it('should list approval requests', async () => {
            const response = await request(app)
                .get('/api/v1/approvals')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.approvals).toBeDefined();
            expect(Array.isArray(response.body.approvals)).toBe(true);
            expect(response.body.pagination).toBeDefined();
        });

        it('should filter by status', async () => {
            const response = await request(app)
                .get('/api/v1/approvals?status=DRAFT')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.approvals.every((a: any) => a.status === 'DRAFT')).toBe(true);
        });
    });

    describe('GET /api/v1/approvals/:id', () => {
        it('should get approval details', async () => {
            const response = await request(app)
                .get(`/api/v1/approvals/${createdApprovalId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(createdApprovalId);
            expect(response.body.assets).toBeDefined();
            expect(response.body.reviewers).toBeDefined();
        });

        it('should return 404 for non-existent approval', async () => {
            const response = await request(app)
                .get('/api/v1/approvals/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /api/v1/approvals/:id', () => {
        it('should update approval request', async () => {
            const response = await request(app)
                .put(`/api/v1/approvals/${createdApprovalId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Updated Title',
                    priority: 'URGENT',
                });

            expect(response.status).toBe(200);
            expect(response.body.title).toBe('Updated Title');
            expect(response.body.priority).toBe('URGENT');
        });
    });

    describe('POST /api/v1/approvals/:id/reviewers', () => {
        it('should add reviewers', async () => {
            const response = await request(app)
                .post(`/api/v1/approvals/${createdApprovalId}/reviewers`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reviewers: [
                        { email: 'reviewer1@test.com', name: 'Reviewer One' },
                        { email: 'reviewer2@test.com' },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.length).toBe(2);
            expect(response.body[0].token).toBeDefined();

            reviewerToken = response.body[0].token;
        });
    });

    describe('POST /api/v1/approvals/:id/comments', () => {
        it('should add a comment', async () => {
            const response = await request(app)
                .post(`/api/v1/approvals/${createdApprovalId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    content: 'This is a test comment',
                });

            expect(response.status).toBe(201);
            expect(response.body.content).toBe('This is a test comment');
        });
    });

    describe('External Reviewer Access', () => {
        describe('GET /api/v1/approvals/review/:token', () => {
            it('should get approval by token without auth', async () => {
                const response = await request(app)
                    .get(`/api/v1/approvals/review/${reviewerToken}`);

                expect(response.status).toBe(200);
                expect(response.body.approval).toBeDefined();
                expect(response.body.reviewer).toBeDefined();
            });

            it('should return 404 for invalid token', async () => {
                const response = await request(app)
                    .get('/api/v1/approvals/review/invalidtoken123');

                expect(response.status).toBe(404);
            });
        });

        describe('POST /api/v1/approvals/review/:token/comments', () => {
            it('should allow external reviewer to comment', async () => {
                const response = await request(app)
                    .post(`/api/v1/approvals/review/${reviewerToken}/comments`)
                    .send({
                        content: 'External reviewer comment',
                    });

                expect(response.status).toBe(201);
            });
        });

        describe('POST /api/v1/approvals/review/:token/decision', () => {
            it('should submit decision', async () => {
                const response = await request(app)
                    .post(`/api/v1/approvals/review/${reviewerToken}/decision`)
                    .send({
                        decision: 'APPROVED',
                        note: 'Looks good!',
                    });

                expect(response.status).toBe(200);
                expect(response.body.decision).toBe('APPROVED');
            });
        });

        describe('POST /api/v1/approvals/:id/review (Authenticated)', () => {
            it('should submit decision as authenticated user', async () => {
                // 1. Create a new user to be a reviewer
                const authData = await registerUser(app);
                const reviewerUser = authData.user;
                const reviewerAuthToken = authData.accessToken;

                // 2. Add this user as a reviewer
                await request(app)
                    .post(`/api/v1/approvals/${createdApprovalId}/reviewers`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        reviewers: [{ email: reviewerUser.email }]
                    });

                // 3. Submit decision
                const response = await request(app)
                    .post(`/api/v1/approvals/${createdApprovalId}/review`)
                    .set('Authorization', `Bearer ${reviewerAuthToken}`)
                    .send({
                        decision: 'CHANGES_REQUESTED',
                        note: 'Please fix the logo',
                    });

                expect(response.status).toBe(200);
                expect(response.body.decision).toBe('CHANGES_REQUESTED');
            });
        });
    });

    describe('DELETE /api/v1/approvals/:id', () => {
        it('should delete approval request', async () => {
            const response = await request(app)
                .delete(`/api/v1/approvals/${createdApprovalId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(204);
        });

        it('should return 404 after deletion', async () => {
            const response = await request(app)
                .get(`/api/v1/approvals/${createdApprovalId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });
});
