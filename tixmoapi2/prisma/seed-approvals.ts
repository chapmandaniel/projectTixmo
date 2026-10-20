/* eslint-disable no-console */
import { ApprovalStatus, EventStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createDevelopmentClient } from './utils/development-client';

const prisma = createDevelopmentClient();

async function main() {
  const password = process.env.TIXMO_DEV_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'Approvals fixtures require TIXMO_DEV_SEED_PASSWORD with at least 12 characters.'
    );
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();
  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.upsert({
      where: { slug: 'tixmo-approvals-dev' },
      update: {},
      create: {
        name: 'Tixmo Approvals Development',
        slug: 'tixmo-approvals-dev',
        type: 'PROMOTER',
        status: 'ACTIVE',
      },
    });
    const user = await tx.user.upsert({
      where: { email: 'approvals.admin@tixmo.test' },
      // Existing accounts retain their credentials and organization.
      update: {},
      create: {
        email: 'approvals.admin@tixmo.test',
        firstName: 'Approvals',
        lastName: 'Admin',
        role: 'ADMIN',
        passwordHash,
        emailVerified: true,
        organizationId: org.id,
      },
    });
    if (user.organizationId !== org.id) {
      throw new Error('The approvals fixture account belongs to another organization.');
    }
    const fixtures = [
      {
        slug: 'approvals-development-festival',
        name: 'Development Music Festival',
        status: EventStatus.PUBLISHED,
      },
      {
        slug: 'approvals-development-summit',
        name: 'Development Summit',
        status: EventStatus.DRAFT,
      },
    ];
    const events = [];
    for (const fixture of fixtures) {
      const event = await tx.event.upsert({
        where: { slug: fixture.slug },
        update: {},
        create: {
          ...fixture,
          organizationId: org.id,
          tags: [],
          timezone: 'America/St_Johns',
          startDatetime: new Date(now + 14 * 86400000),
          endDatetime: new Date(now + 15 * 86400000),
          capacity: 2000,
        },
      });
      if (event.organizationId !== org.id)
        throw new Error('An approvals fixture event belongs to another organization.');
      events.push(event);
    }
    const approvals = [
      {
        eventId: events[0].id,
        title: 'Main Festival Banner',
        description: 'Large banner for the main entrance.',
        status: ApprovalStatus.PENDING_REVIEW,
        filename: 'banner_v1.jpg',
      },
      {
        eventId: events[0].id,
        title: 'Artist Lineup Announcement',
        description: 'Social post announcing the artist lineup.',
        status: ApprovalStatus.PENDING_REVIEW,
        filename: 'lineup_post.jpg',
      },
      {
        eventId: events[1].id,
        title: 'Speaker Reveal',
        description: 'Keynote announcement awaiting a revision.',
        status: ApprovalStatus.CHANGES_REQUESTED,
      },
    ];
    for (const fixture of approvals) {
      const existing = await tx.approvalRequest.findFirst({
        where: { eventId: fixture.eventId, title: fixture.title, organizationId: org.id },
      });
      if (existing) continue;
      await tx.approvalRequest.create({
        data: {
          eventId: fixture.eventId,
          title: fixture.title,
          description: fixture.description,
          status: fixture.status,
          organizationId: org.id,
          createdById: user.id,
          deadline: new Date(now + 7 * 86400000),
          revisions: {
            create: {
              revisionNumber: 1,
              summary: 'Development fixture',
              uploadedById: user.id,
              assets: {
                create: {
                  filename: fixture.filename || 'speaker.jpg',
                  originalName: fixture.filename || 'speaker.jpg',
                  mimeType: 'image/jpeg',
                  size: 500000,
                  s3Key: 'development/approvals-placeholder.jpg',
                  s3Url: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9',
                },
              },
            },
          },
        },
      });
    }
  });
  console.log(
    'Approvals development fixtures are ready. Existing account credentials were preserved.'
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Approvals fixture creation failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
