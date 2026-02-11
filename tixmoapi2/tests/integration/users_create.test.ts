import request from 'supertest';
import app from '../../src/app';
import { prisma, cleanupTestData, registerUser } from '../utils/testUtils';
import { UserRole } from '@prisma/client';

describe('User Creation Authorization (RBAC)', () => {
    let ownerToken: string;
    let adminToken: string;
    let promoterUser: any;
    let promoterToken: string;
    let otherOrgId: string;

    beforeAll(async () => {
        await cleanupTestData();

        // 1. Create Owner
        const ownerData = await registerUser(app, {
            email: 'owner@test.com',
            firstName: 'Owner',
            lastName: 'User',
        });
        await prisma.user.update({
            where: { id: ownerData.user.id },
            data: { role: UserRole.OWNER },
        });
        // Re-login to get OWNER token
        const ownerLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'owner@test.com',
            password: 'SecurePass123!',
        });
        ownerToken = ownerLogin.body.data.accessToken;

        // 2. Create Admin
        const adminData = await registerUser(app, {
            email: 'admin@test.com',
            firstName: 'Admin',
            lastName: 'User',
        });
        await prisma.user.update({
            where: { id: adminData.user.id },
            data: { role: UserRole.ADMIN },
        });
        const adminLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'admin@test.com',
            password: 'SecurePass123!',
        });
        adminToken = adminLogin.body.data.accessToken;

        // 3. Create Promoter
        const org = await prisma.organization.create({
            data: { name: 'Test Org', slug: 'test-org', type: 'PROMOTER' },
        });
        const otherOrg = await prisma.organization.create({
            data: { name: 'Other Org', slug: 'other-org', type: 'PROMOTER' },
        });
        otherOrgId = otherOrg.id;

        const promoterData = await registerUser(app, {
            email: 'promoter@test.com',
            firstName: 'Promoter',
            lastName: 'User',
        });
        promoterUser = await prisma.user.update({
            where: { id: promoterData.user.id },
            data: { role: UserRole.PROMOTER, organizationId: org.id },
        });
        const promoterLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'promoter@test.com',
            password: 'SecurePass123!',
        });
        promoterToken = promoterLogin.body.data.accessToken;
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    describe('POST /api/v1/users (Role Hierarchy)', () => {
        it('should allow ADMIN to create a PROMOTER', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'new_promoter@test.com',
                    firstName: 'New',
                    lastName: 'Promoter',
                    role: 'PROMOTER',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('PROMOTER');
        });

        it('should allow PROMOTER to create a TEAM_MEMBER', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${promoterToken}`)
                .send({
                    email: 'team@test.com',
                    firstName: 'Team',
                    lastName: 'Member',
                    role: 'TEAM_MEMBER',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('TEAM_MEMBER');
            expect(res.body.data.organizationId).toBe(promoterUser.organizationId);
        });

        it('should forbid PROMOTER from creating an ADMIN (Privilege Escalation)', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${promoterToken}`)
                .send({
                    email: 'hacker_admin@test.com',
                    firstName: 'Hacker',
                    lastName: 'Admin',
                    role: 'ADMIN',
                });

            expect(res.status).toBe(403);
            expect(res.body.message).toContain('cannot create a user with role ADMIN');
        });

        it('should forbid PROMOTER from creating another PROMOTER (Equal Role)', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${promoterToken}`)
                .send({
                    email: 'another_promoter@test.com',
                    firstName: 'Another',
                    lastName: 'Promoter',
                    role: 'PROMOTER',
                });

            expect(res.status).toBe(403);
        });

        it('should allow OWNER to create an OWNER', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${ownerToken}`)
                .send({
                    email: 'another_owner@test.com',
                    firstName: 'Another',
                    lastName: 'Owner',
                    role: 'OWNER',
                });

            expect(res.status).toBe(201);
        });
    });

    describe('POST /api/v1/users (Organization Scoping)', () => {
        it('should force PROMOTER to create users in their own organization', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${promoterToken}`)
                .send({
                    email: 'other_org_user@test.com',
                    firstName: 'Other',
                    lastName: 'Org',
                    role: 'TEAM_MEMBER',
                    organizationId: otherOrgId, // Try to create in another org
                });

            expect(res.status).toBe(201);
            // Even if they passed otherOrgId, it should be overridden by promoter's orgId
            expect(res.body.data.organizationId).toBe(promoterUser.organizationId);
            expect(res.body.data.organizationId).not.toBe(otherOrgId);
        });
    });
});
