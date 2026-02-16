
import { PrismaClient, ApprovalType, ApprovalStatus, ApprovalPriority } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting Approvals Seed...');

    // 1. Create Organization & User
    const email = 'admin@tixmo.com';
    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 10);

    const org = await prisma.organization.upsert({
        where: { slug: 'tixmo-hq' },
        update: {},
        create: {
            name: 'TixMo HQ',
            slug: 'tixmo-hq',
            type: 'PROMOTER',
            status: 'ACTIVE',
        },
    });

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash,
            organizationId: org.id,
        },
        create: {
            email,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            passwordHash,
            phone: '555-0123',
            emailVerified: true,
            organizationId: org.id,
        },
    });

    console.log(`✓ User: ${user.email}`);

    // 1.5 Create Venue
    const venue = await prisma.venue.create({
        data: {
            organizationId: org.id,
            name: 'Central Park',
            address: {
                street: '5th Ave & W 59th St',
                city: 'New York',
                state: 'NY',
                zip: '10022',
                country: 'USA'
            },
            capacity: 50000,
            timezone: 'America/New_York'
        }
    });

    // 2. Create Events
    const event1 = await prisma.event.create({
        data: {
            organizationId: org.id,
            name: 'Summer Music Festival 2024',
            slug: 'summer-music-fest-2024',
            description: 'The biggest music festival of the summer.',
            startDatetime: new Date('2024-07-15'),
            endDatetime: new Date('2024-07-17'),
            status: 'PUBLISHED',
            venueId: venue.id,
            capacity: 5000,
        },
    });

    const event2 = await prisma.event.create({
        data: {
            organizationId: org.id,
            name: 'Tech Innovators Summit',
            slug: 'tech-summit-2024',
            description: 'Connecting the brightest minds in tech.',
            startDatetime: new Date('2024-09-10'),
            endDatetime: new Date('2024-09-12'),
            status: 'DRAFT',
            venueId: venue.id,
            capacity: 2000,
        },
    });

    console.log(`✓ Created 2 Events`);

    // 3. Create Media Approvals
    await prisma.approvalRequest.create({
        data: {
            organizationId: org.id,
            eventId: event1.id,
            createdById: user.id,
            title: 'Main Festival Banner',
            description: 'Large banner for the main entrance.',
            type: ApprovalType.MEDIA,
            priority: ApprovalPriority.URGENT,
            status: ApprovalStatus.PENDING,
            dueDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
            assets: {
                create: {
                    filename: 'banner_v1.jpg',
                    originalName: 'banner_v1.jpg',
                    mimeType: 'image/jpeg',
                    s3Key: 'mock-banner',
                    s3Url: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97edf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
                    size: 1024000,
                    version: 1
                }
            }
        },
    });

    // 4. Create Social Approvals
    await prisma.approvalRequest.create({
        data: {
            organizationId: org.id,
            eventId: event1.id,
            createdById: user.id,
            title: 'Artist Lineup Announcement',
            description: 'Instagram post announcing the first wave of artists.',
            type: ApprovalType.SOCIAL,
            priority: ApprovalPriority.STANDARD,
            status: ApprovalStatus.DRAFT,
            dueDate: new Date(Date.now() + 86400000 * 5),
            content: {
                platform: 'instagram',
                caption: 'We are thrilled to announce the first wave of artists for #SummerFest2024! 🎸☀️ Get your tickets now! link in bio.',
                hashtags: '#musicfestival #livemusic #summer'
            },
            assets: {
                create: {
                    filename: 'lineup_post.jpg',
                    originalName: 'lineup_post.jpg',
                    mimeType: 'image/jpeg',
                    s3Key: 'mock-post',
                    s3Url: 'https://images.unsplash.com/photo-1459749411177-d4a4282ff7dd?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
                    size: 500000,
                    version: 1
                }
            }
        },
    });

    await prisma.approvalRequest.create({
        data: {
            organizationId: org.id,
            eventId: event2.id,
            createdById: user.id,
            title: 'Speaker Reveal - Keynote',
            type: ApprovalType.SOCIAL,
            status: ApprovalStatus.CHANGES_REQUESTED,
            priority: ApprovalPriority.CRITICAL,
            content: {
                platform: 'linkedin',
                caption: 'Honored to welcome our keynote speaker for the Tech Innovators Summit. Join us for an inspiring talk on the future of AI.',
            }
        },
    });

    console.log('✓ Created Sample Approvals');
    console.log('🌱 Seed Completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
