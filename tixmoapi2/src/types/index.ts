export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  PROMOTER = 'promoter',
  CUSTOMER = 'customer',
  SCANNER = 'scanner',
  TEAM_MEMBER = 'team_member',
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  stripeAccountId?: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum OrganizationType {
  PROMOTER = 'promoter',
  VENUE = 'venue',
  RESELLER = 'reseller',
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}
