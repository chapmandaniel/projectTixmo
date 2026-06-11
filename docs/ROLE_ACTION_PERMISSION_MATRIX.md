# Tixmo Role And Action Permission Matrix

Use this matrix for beta setup, support decisions, and QA. It describes current enforced API behavior plus the dashboard permissions captured for custom team members.

## Role Hierarchy

| Role | Level | Beta meaning |
| --- | ---: | --- |
| `OWNER` | 5 | Highest organization operator. Can assign any role and manage lower/equal roles by current API policy. |
| `ADMIN` | 4 | Senior organization operator. Can manage lower roles only. |
| `MANAGER` | 3 | Operational lead. Can manage promoter, team member, and scanner roles. |
| `PROMOTER` | 2 | Event operator. Can manage team member and scanner roles. |
| `TEAM_MEMBER` | 1 | Custom dashboard access profile. Custom permissions are stored but broad API route enforcement does not yet consume them. |
| `SCANNER` | 1 | Entry staff identity role. Scanner API access uses scanner API keys, not user JWT role. |
| `CUSTOMER` | 0 | Buyer/self-service user. |

Rules now enforced:

- Non-owner users cannot create, assign, update, or delete users with a role equal to or higher than their own.
- Users cannot change their own role, organization, or permissions.
- Organization-scoped owners/admins/managers/promoters are forced to operate inside their own organization.
- Global owners/admins with no organization can intentionally operate across organizations.

## Core Product Actions

| Action | OWNER | ADMIN | MANAGER | PROMOTER | TEAM_MEMBER | SCANNER | CUSTOMER | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Register/sign in | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Role is assigned after auth or by team invite. |
| View own profile | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Self only unless elevated and scoped access permits. |
| Update own profile | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Self role/org/permissions changes are blocked. |
| List team members | Yes | Yes | Yes | Yes | No | No | No | Scoped users are forced to their own organization. |
| Invite team member | Yes | Yes | Yes | Yes | No | No | No | Target role must be below caller unless caller is owner. |
| Change member role | Yes | Yes | Yes | Yes | No | No | No | Target member and assigned role must be manageable by hierarchy. |
| Remove member | Yes | Yes | Yes | Yes | No | No | No | Route restrictions plus hierarchy and org checks apply. |
| Create/update organizations | Yes | Yes | Yes | Yes | No | No | No | Subject to organization scope checks in controllers. |
| List all organizations | Yes | Yes | No | No | No | No | No | Global/scoped behavior depends on caller organization context. |
| Delete organization | Yes | Yes | No | No | No | No | No | Blocked when dependent events or venues exist. |
| Create/update/publish/cancel events | Yes | Yes | Yes | Yes | No | No | No | Event access is organization scoped. |
| Delete/restore events | Yes | Yes | No | No | No | No | No | Delete is soft-delete and blocked when tickets exist. |
| Manage venues | Yes | Yes | Yes | Yes | No | No | No | Venue delete is owner/admin only. |
| Manage ticket types | Yes | Yes | Yes | Yes | No | No | No | Ticket type delete is owner/admin only. |
| Manage ticket tiers | Yes | Yes | Yes | Yes | No | No | No | Tier delete is allowed only when no tier tickets have sold. |
| Confirm/cancel orders | Yes | Yes | Yes | Yes | No | No | Customer-owned | Refund is owner/admin only. |
| Refund orders | Yes | Yes | No | No | No | No | No | Stripe financial action must still be confirmed separately. |
| View analytics/reports | Yes | Yes | Yes | Yes | No | No | No | Analytics and report routes authorize the four operator roles. |
| Register/revoke scanners | Yes | Yes | Yes | Yes | No | No | No | Scanner auth itself uses scanner API keys. |
| Online scan via scanner key | Key | Key | Key | Key | Key | Key | Key | Requires active scanner API key, not user role. |
| Offline sync/upload via scanner key | Key | Key | Key | Key | Key | Key | Key | Scanner must be active and assigned/authorized for event. |
| Manage approvals | Auth | Auth | Auth | Auth | Auth | Auth | Auth | Approval routes require authentication and enforce ownership/scope in service logic. |
| External review link actions | Public token | Public token | Public token | Public token | Public token | Public token | Public token | Token is treated as credential. |
| Manage asset library | Auth | Auth | Auth | Auth | Auth | Auth | Auth | Asset service enforces organization scope from the authenticated user. |
| Public asset share access | Public token | Public token | Public token | Public token | Public token | Public token | Public token | Revocation/expiry controls access. |

Legend:

- `Yes`: role is directly allowed by current route/controller policy.
- `No`: role is not allowed by current route/controller policy.
- `Auth`: route requires authentication; detailed access is handled in service/controller scope checks rather than a simple role gate.
- `Key`: scanner API key is the credential.
- `Public token`: possession of the external token controls access.

## Custom Team Member Permissions

The Team Member wizard stores these permission flags:

| Permission | Intended product meaning | Current beta enforcement |
| --- | --- | --- |
| `manageEvents` | Create and edit events | Stored on user, not broadly enforced by API route authorization. |
| `viewAnalytics` | See sales and traffic data | Stored on user, not broadly enforced by API route authorization. |
| `manageTickets` | Create and edit ticket types | Stored on user, not broadly enforced by API route authorization. |
| `scanTickets` | Perform check-ins | Stored on user, not used for scanner API key auth. |
| `manageTeam` | Add and remove team members | Stored on user, not broadly enforced by API route authorization. |

Beta decision:

- Use `OWNER`, `ADMIN`, `MANAGER`, and `PROMOTER` for staff who need reliable dashboard operations today.
- Use `TEAM_MEMBER` custom permissions only as stored metadata until route-level permission middleware consumes them.
- Use scanner API keys for entry devices instead of relying on the `SCANNER` user role.

## QA Checklist

- [ ] Owner can invite owner/admin/manager/promoter/team member/scanner within organization scope.
- [ ] Admin can invite only lower roles and cannot create another admin.
- [ ] Manager can invite promoter/team member/scanner and cannot create manager/admin/owner.
- [ ] Promoter can invite team member/scanner and cannot create promoter/manager/admin/owner.
- [ ] Scoped owner/admin cannot list or invite users into another organization.
- [ ] A user cannot change their own role, organization, or permissions.
- [ ] Team page can downgrade a manageable lower-role member.
- [ ] Global admin behavior is intentionally tested before production if a global admin account is used.
