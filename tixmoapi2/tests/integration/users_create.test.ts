import request from 'supertest';
import app from '../../src/app';
import { prisma, cleanupTestData, registerUser } from '../utils/testUtils';
import { UserRole } from '@prisma/client';

describe('User Creation Authorization (RBAC)', () => {
    let ownerToken: string;
    let adminToken: string;
    let ownerWithOrgToken: string;
    let adminWithOrgToken: string;
    let promoterUser: any;
    let promoterToken: string;
    let managerUser: any;
    let managerToken: string;
    let otherOrgId: string;
    let scopedOrgId: string;

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

        const scopedOrg = await prisma.organization.create({
            data: { name: 'Scoped Org', slug: 'scoped-org', type: 'PROMOTER' },
        });
        scopedOrgId = scopedOrg.id;

        const ownerWithOrgData = await registerUser(app, {
            email: 'owner-with-org@test.com',
            firstName: 'Scoped',
            lastName: 'Owner',
        });
        await prisma.user.update({
            where: { id: ownerWithOrgData.user.id },
            data: { role: UserRole.OWNER, organizationId: scopedOrgId },
        });
        const ownerWithOrgLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'owner-with-org@test.com',
            password: 'SecurePass123!',
        });
        ownerWithOrgToken = ownerWithOrgLogin.body.data.accessToken;

        const adminWithOrgData = await registerUser(app, {
            email: 'admin-with-org@test.com',
            firstName: 'Scoped',
            lastName: 'Admin',
        });
        await prisma.user.update({
            where: { id: adminWithOrgData.user.id },
            data: { role: UserRole.ADMIN, organizationId: scopedOrgId },
        });
        const adminWithOrgLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'admin-with-org@test.com',
            password: 'SecurePass123!',
        });
        adminWithOrgToken = adminWithOrgLogin.body.data.accessToken;

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

        const managerData = await registerUser(app, {
            email: 'manager@test.com',
            firstName: 'Manager',
            lastName: 'User',
        });
        managerUser = await prisma.user.update({
            where: { id: managerData.user.id },
            data: { role: UserRole.MANAGER, organizationId: org.id },
        });
        const managerLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'manager@test.com',
            password: 'SecurePass123!',
        });
        managerToken = managerLogin.body.data.accessToken;
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

        it('should allow ADMIN to create a MANAGER', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${adminWithOrgToken}`)
                .send({
                    email: 'new_manager@test.com',
                    firstName: 'New',
                    lastName: 'Manager',
                    role: 'MANAGER',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('MANAGER');
            expect(res.body.data.organizationId).toBe(scopedOrgId);
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

        it('should allow MANAGER to create a TEAM_MEMBER in their own organization', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    email: 'manager_team@test.com',
                    firstName: 'Manager',
                    lastName: 'Team',
                    role: 'TEAM_MEMBER',
                    organizationId: otherOrgId,
                });

            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('TEAM_MEMBER');
            expect(res.body.data.organizationId).toBe(managerUser.organizationId);
            expect(res.body.data.organizationId).not.toBe(otherOrgId);
        });

        it('should allow MANAGER to create a PROMOTER in their own organization', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    email: 'manager_promoter@test.com',
                    firstName: 'Manager',
                    lastName: 'Promoter',
                    role: 'PROMOTER',
                    organizationId: otherOrgId,
                });

            expect(res.status).toBe(201);
            expect(res.body.data.role).toBe('PROMOTER');
            expect(res.body.data.organizationId).toBe(managerUser.organizationId);
            expect(res.body.data.organizationId).not.toBe(otherOrgId);
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

        it('should forbid PROMOTER from creating a MANAGER', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${promoterToken}`)
                .send({
                    email: 'manager_escalation@test.com',
                    firstName: 'Manager',
                    lastName: 'Escalation',
                    role: 'MANAGER',
                });

            expect(res.status).toBe(403);
            expect(res.body.message).toContain('cannot create a user with role MANAGER');
        });

        it('should forbid MANAGER from creating another MANAGER', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${managerToken}`)
                .send({
                    email: 'peer_manager@test.com',
                    firstName: 'Peer',
                    lastName: 'Manager',
                    role: 'MANAGER',
                });

            expect(res.status).toBe(403);
            expect(res.body.message).toContain('cannot create a user with role MANAGER');
        });

        it('should forbid ADMIN from creating another ADMIN', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${adminWithOrgToken}`)
                .send({
                    email: 'peer_admin@test.com',
                    firstName: 'Peer',
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

        it('should inherit the OWNER organization when orgId is omitted', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${ownerWithOrgToken}`)
                .send({
                    email: 'owner_scoped_team@test.com',
                    firstName: 'Owner',
                    lastName: 'Scoped Team',
                    role: 'TEAM_MEMBER',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.organizationId).toBe(scopedOrgId);
        });

        it('should inherit the ADMIN organization when orgId is omitted', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${adminWithOrgToken}`)
                .send({
                    email: 'admin_scoped_team@test.com',
                    firstName: 'Admin',
                    lastName: 'Scoped Team',
                    role: 'TEAM_MEMBER',
                });

            expect(res.status).toBe(201);
            expect(res.body.data.organizationId).toBe(scopedOrgId);
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
