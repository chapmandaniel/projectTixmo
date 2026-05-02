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

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lZp8eQAAAABJRU5ErkJggg==',
  'base64'
);

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
      .field(
        'reviewers',
        JSON.stringify([{ email: 'manager@example.com', association: 'MANAGEMENT' }])
      )
      .attach('files', tinyPng, {
        filename: 'artwork.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe('Main stage LED artwork');
    expect(response.body.status).toBe('PENDING_REVIEW');
    expect(response.body.latestRevisionNumber).toBe(1);
    expect(response.body.reviewers).toHaveLength(1);
    expect(response.body.reviewers[0].association).toBe('MANAGEMENT');
    expect(response.body.reviewers[0].reviewUrl).toContain('/review/');
    expect(response.body.latestRevision.assets).toHaveLength(1);
  });

  it('lists approval requests with creative workflow fields', async () => {
    const response = await request(app)
      .get('/api/v1/approvals?status=PENDING_REVIEW')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.approvals)).toBe(true);
    expect(response.body.approvals[0]).toHaveProperty('latestRevision');
    expect(response.body.approvals[0].reviewers[0]).toHaveProperty('reviewUrl');
  });

  it('adds a reviewer to an existing approval request', async () => {
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { title: 'Main stage LED artwork' },
    });

    const response = await request(app)
      .post(`/api/v1/approvals/${approval.id}/reviewers`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        reviewers: [{ email: 'second-reviewer@example.com', association: 'AGENT' }],
      });

    expect(response.status).toBe(201);
    expect(response.body.reviewers).toHaveLength(2);
    expect(response.body.reviewers.map((reviewer: { email: string }) => reviewer.email)).toContain(
      'second-reviewer@example.com'
    );
    expect(
      response.body.reviewers.find(
        (reviewer: { email: string }) => reviewer.email === 'second-reviewer@example.com'
      )?.association
    ).toBe('AGENT');
    expect(response.body.status).toBe('PENDING_REVIEW');
  });

  it('resends an invite for an existing reviewer with a fresh secure token', async () => {
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { title: 'Main stage LED artwork' },
      include: { reviewers: true },
    });

    const reviewer = approval.reviewers.find(
      (item) => item.email === 'second-reviewer@example.com'
    );
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

    const reviewer = approval.reviewers.find(
      (item) => item.email === 'second-reviewer@example.com'
    );
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

  it('allows invited reviewers to add another reviewer from the secure portal', async () => {
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { title: 'Main stage LED artwork' },
      include: { reviewers: true },
    });

    const invitingReviewer = approval.reviewers.find(
      (reviewer) => reviewer.email === 'manager@example.com'
    );
    expect(invitingReviewer).toBeDefined();

    const response = await request(app)
      .post(`/api/v1/review/${invitingReviewer?.token}/reviewers`)
      .send({
        reviewers: [{ email: 'agent-approval@example.com', association: 'AGENT' }],
      });

    expect(response.status).toBe(201);
    expect(response.body.reviewer.id).toBe(invitingReviewer?.id);
    expect(
      response.body.approval.reviewers.map((reviewer: { email: string }) => reviewer.email)
    ).toContain('agent-approval@example.com');
    expect(
      response.body.approval.reviewers.find(
        (reviewer: { email: string }) => reviewer.email === 'agent-approval@example.com'
      )?.association
    ).toBe('AGENT');
  });

  it('prevents invited reviewers from adding reviewers after approval is complete', async () => {
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { title: 'Main stage LED artwork' },
      include: { reviewers: true },
    });

    const invitingReviewer = approval.reviewers.find(
      (reviewer) => reviewer.email === 'manager@example.com'
    );
    expect(invitingReviewer).toBeDefined();

    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'APPROVED', completedAt: new Date() },
    });

    const response = await request(app)
      .post(`/api/v1/review/${invitingReviewer?.token}/reviewers`)
      .send({
        reviewers: [{ email: 'late-reviewer@example.com', association: 'AGENT' }],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Cannot add reviewers after this approval is complete');

    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: 'CHANGES_REQUESTED', completedAt: null },
    });
  });

  it('keeps internal comments private while allowing authors to delete their own messages', async () => {
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { title: 'Main stage LED artwork' },
      include: {
        reviewers: true,
        revisions: {
          orderBy: { revisionNumber: 'desc' },
          take: 1,
        },
      },
    });

    const latestRevisionId = approval.revisions[0].id;
    const managerReviewer = approval.reviewers.find(
      (reviewer) => reviewer.email === 'manager@example.com'
    );
    expect(managerReviewer).toBeDefined();
    const reviewerToken = managerReviewer?.token;

    const globalCommentResponse = await request(app)
      .post(`/api/v1/approvals/${approval.id}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'This update can stay open to invited reviewers.',
        revisionId: latestRevisionId,
        visibility: 'GLOBAL',
      });
    expect(globalCommentResponse.status).toBe(201);

    const internalCommentResponse = await request(app)
      .post(`/api/v1/approvals/${approval.id}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        content: 'This note should stay inside the logged-in team thread.',
        revisionId: latestRevisionId,
        visibility: 'INTERNAL',
      });
    expect(internalCommentResponse.status).toBe(201);

    const internalViewResponse = await request(app)
      .get(`/api/v1/approvals/${approval.id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(internalViewResponse.status).toBe(200);
    expect(
      internalViewResponse.body.comments.map((comment: { content: string }) => comment.content)
    ).toEqual(
      expect.arrayContaining([
        'This update can stay open to invited reviewers.',
        'This note should stay inside the logged-in team thread.',
      ])
    );

    const externalViewResponse = await request(app).get(`/api/v1/review/${reviewerToken}`);
    expect(externalViewResponse.status).toBe(200);
    expect(
      externalViewResponse.body.approval.comments.map(
        (comment: { content: string }) => comment.content
      )
    ).toEqual(expect.arrayContaining(['This update can stay open to invited reviewers.']));
    expect(
      externalViewResponse.body.approval.comments.map(
        (comment: { content: string }) => comment.content
      )
    ).not.toContain('This note should stay inside the logged-in team thread.');
    expect(externalViewResponse.body.reviewer.association).toBe('MANAGEMENT');

    const deleteGlobalResponse = await request(app)
      .delete(`/api/v1/approvals/${approval.id}/comments/${globalCommentResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(deleteGlobalResponse.status).toBe(200);
    expect(
      deleteGlobalResponse.body.comments.map((comment: { id: string }) => comment.id)
    ).not.toContain(globalCommentResponse.body.id);

    const externalCommentResponse = await request(app)
      .post(`/api/v1/review/${reviewerToken}/comments`)
      .send({
        content: 'Reviewer follow-up that should be deletable by the same reviewer.',
        revisionId: latestRevisionId,
      });
    expect(externalCommentResponse.status).toBe(201);

    const deleteExternalResponse = await request(app).delete(
      `/api/v1/review/${reviewerToken}/comments/${externalCommentResponse.body.id}`
    );
    expect(deleteExternalResponse.status).toBe(200);
    expect(
      deleteExternalResponse.body.approval.comments.map((comment: { id: string }) => comment.id)
    ).not.toContain(externalCommentResponse.body.id);

    const forbiddenDeleteResponse = await request(app).delete(
      `/api/v1/review/${reviewerToken}/comments/${internalCommentResponse.body.id}`
    );
    expect(forbiddenDeleteResponse.status).toBe(403);
  });

  it('creates a new revision and updates the dashboard status', async () => {
    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { title: 'Main stage LED artwork' },
    });

    const response = await request(app)
      .post(`/api/v1/approvals/${approval.id}/revisions`)
      .set('Authorization', `Bearer ${authToken}`)
      .field('summary', 'Adjusted sponsor lockup and headline spacing.')
      .attach('files', tinyPng, {
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
      .attach('files', tinyPng, {
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
