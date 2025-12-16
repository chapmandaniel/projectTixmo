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
  ADMIN = 'admin',
  PROMOTER = 'promoter',
  CUSTOMER = 'customer',
  SCANNER = 'scanner',
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
