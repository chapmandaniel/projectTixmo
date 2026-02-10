import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { createTestUser, createTestOrganization, createTestEvent, getAuthToken } from '../helpers/testUtils';

describe('Approvals API Integration Tests', () => {
    let authToken: string;
    let testUser: any;
    let testOrg: any;
    let testEvent: any;
    let createdApprovalId: string;
    let reviewerToken: string;

    beforeAll(async () => {
        // Create test organization
        testOrg = await createTestOrganization();

        // Create test user
        testUser = await createTestUser(testOrg.id);
        authToken = await getAuthToken(testUser);

        // Create test event
        testEvent = await createTestEvent(testOrg.id);
    });

    afterAll(async () => {
        // Cleanup
        await prisma.approvalComment.deleteMany({ where: { approvalRequest: { organizationId: testOrg.id } } });
        await prisma.approvalReviewer.deleteMany({ where: { approvalRequest: { organizationId: testOrg.id } } });
        await prisma.approvalAsset.deleteMany({ where: { approvalRequest: { organizationId: testOrg.id } } });
        await prisma.approvalRequest.deleteMany({ where: { organizationId: testOrg.id } });
        await prisma.event.deleteMany({ where: { organizationId: testOrg.id } });
        await prisma.user.deleteMany({ where: { organizationId: testOrg.id } });
        await prisma.organization.deleteMany({ where: { id: testOrg.id } });
    });

    describe('POST /v1/approvals', () => {
        it('should create a new approval request', async () => {
            const response = await request(app)
                .post('/v1/approvals')
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
                .post('/v1/approvals')
                .send({
                    eventId: testEvent.id,
                    title: 'Test',
                });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /v1/approvals', () => {
        it('should list approval requests', async () => {
            const response = await request(app)
                .get('/v1/approvals')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.approvals).toBeDefined();
            expect(Array.isArray(response.body.approvals)).toBe(true);
            expect(response.body.pagination).toBeDefined();
        });

        it('should filter by status', async () => {
            const response = await request(app)
                .get('/v1/approvals?status=DRAFT')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.approvals.every((a: any) => a.status === 'DRAFT')).toBe(true);
        });
    });

    describe('GET /v1/approvals/:id', () => {
        it('should get approval details', async () => {
            const response = await request(app)
                .get(`/v1/approvals/${createdApprovalId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(createdApprovalId);
            expect(response.body.assets).toBeDefined();
            expect(response.body.reviewers).toBeDefined();
        });

        it('should return 404 for non-existent approval', async () => {
            const response = await request(app)
                .get('/v1/approvals/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /v1/approvals/:id', () => {
        it('should update approval request', async () => {
            const response = await request(app)
                .put(`/v1/approvals/${createdApprovalId}`)
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

    describe('POST /v1/approvals/:id/reviewers', () => {
        it('should add reviewers', async () => {
            const response = await request(app)
                .post(`/v1/approvals/${createdApprovalId}/reviewers`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reviewers: [
                        { email: 'reviewer1@test.com', name: 'Reviewer One' },
                        { email: 'reviewer2@test.com' },
                    ],
                });

            expect(response.status).toBe(201);
            expect(response.body.reviewers.length).toBe(2);
            expect(response.body.reviewers[0].token).toBeDefined();

            reviewerToken = response.body.reviewers[0].token;
        });

        it('should not duplicate reviewers', async () => {
            const response = await request(app)
                .post(`/v1/approvals/${createdApprovalId}/reviewers`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    reviewers: [{ email: 'reviewer1@test.com' }],
                });

            expect(response.status).toBe(201);
            expect(response.body.reviewers.length).toBe(0); // Already exists
        });
    });

    describe('POST /v1/approvals/:id/comments', () => {
        it('should add a comment', async () => {
            const response = await request(app)
                .post(`/v1/approvals/${createdApprovalId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    content: 'This is a test comment',
                });

            expect(response.status).toBe(201);
            expect(response.body.comment.content).toBe('This is a test comment');
        });
    });

    describe('External Reviewer Access', () => {
        describe('GET /v1/review/:token', () => {
            it('should get approval by token without auth', async () => {
                const response = await request(app)
                    .get(`/v1/review/${reviewerToken}`);

                expect(response.status).toBe(200);
                expect(response.body.approval).toBeDefined();
                expect(response.body.reviewer).toBeDefined();
            });

            it('should return 404 for invalid token', async () => {
                const response = await request(app)
                    .get('/v1/review/invalidtoken123');

                expect(response.status).toBe(404);
            });
        });

        describe('POST /v1/review/:token/comments', () => {
            it('should allow external reviewer to comment', async () => {
                const response = await request(app)
                    .post(`/v1/review/${reviewerToken}/comments`)
                    .send({
                        content: 'External reviewer comment',
                    });

                expect(response.status).toBe(201);
            });
        });

        describe('POST /v1/review/:token/decision', () => {
            it('should submit decision', async () => {
                const response = await request(app)
                    .post(`/v1/review/${reviewerToken}/decision`)
                    .send({
                        decision: 'APPROVED',
                        note: 'Looks good!',
                    });

                expect(response.status).toBe(200);
                expect(response.body.decision).toBe('APPROVED');
            });
        });
    });

    describe('DELETE /v1/approvals/:id', () => {
        it('should delete approval request', async () => {
            const response = await request(app)
                .delete(`/v1/approvals/${createdApprovalId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(204);
        });

        it('should return 404 after deletion', async () => {
            const response = await request(app)
                .get(`/v1/approvals/${createdApprovalId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });
});
