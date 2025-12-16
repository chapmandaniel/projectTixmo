<!-- Authoritative banner: centralize tracking to MASTER_DOCUMENTATION.md and PROGRESS.md -->
> NOTE: `MASTER_DOCUMENTATION.md` is the authoritative documentation for this project and AI agents. For sprint-level tracking and status updates use `PROGRESS.md`.

# TixMo API Contributing Guide

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/tixmoapi2.git`
3. Install dependencies: `npm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Branch Naming Convention
- `feature/` - New features (e.g., `feature/user-authentication`)
- `fix/` - Bug fixes (e.g., `fix/login-error`)
- `refactor/` - Code refactoring (e.g., `refactor/database-queries`)
- `docs/` - Documentation updates (e.g., `docs/api-endpoints`)
- `test/` - Test additions or updates (e.g., `test/user-service`)

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user registration endpoint
fix: resolve JWT expiration issue
docs: update API documentation
style: format code with prettier
refactor: simplify error handling
test: add user service tests
chore: update dependencies
```

### Code Style

- Use TypeScript strict mode
- Follow ESLint and Prettier configurations
- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Testing

- Write unit tests for all utility functions
- Write integration tests for API endpoints
- Aim for >80% code coverage
- Run tests before committing: `npm test`

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check coverage
npm run test:coverage
```

### Pull Request Process

1. Update your branch with main: `git pull origin main`
2. Run tests: `npm test`
3. Run linter: `npm run lint:fix`
4. Format code: `npm run format`
5. Commit your changes
6. Push to your fork: `git push origin feature/your-feature-name`
7. Create a Pull Request

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe the tests you added or modified

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Type safety maintained
```

## Code Review Guidelines

### For Authors
- Keep PRs small and focused
- Provide clear descriptions
- Respond to feedback promptly
- Update based on comments

### For Reviewers
- Be constructive and respectful
- Check for code quality and consistency
- Verify tests are adequate
- Approve when satisfied

## Development Best Practices

### TypeScript
- Use explicit types, avoid `any`
- Use interfaces for object shapes
- Use enums for fixed sets of values
- Leverage type inference when obvious

### Error Handling
- Use ApiError class for API errors
- Use try-catch for async operations
- Log errors appropriately
- Return meaningful error messages

### Database
- Use Prisma migrations
- Never commit database credentials
- Use transactions for multi-step operations
- Optimize queries for performance

### Security
- Never commit secrets or API keys
- Validate all user inputs
- Use parameterized queries
- Implement rate limiting
- Use HTTPS in production

### Performance
- Use Redis for caching
- Implement pagination for lists
- Optimize database queries
- Use compression middleware
- Monitor response times

## Project Structure

```
src/
├── api/              # API routes and controllers
├── services/         # Business logic
├── models/           # Database models
├── middleware/       # Express middleware
├── utils/            # Utility functions
├── config/           # Configuration
└── types/            # TypeScript types

tests/
├── unit/             # Unit tests
├── integration/      # Integration tests
└── e2e/              # End-to-end tests
```

## Questions?

- Check the [Development Plan](./DEVELOPMENT_PLAN.md)
- Review [Next Steps](./NEXT_STEPS.md)
- Check [Project Manager](./PROJECT_MANAGER.md)
- Ask in team chat or create an issue

## Documentation maintenance

This repository uses `MASTER_DOCUMENTATION.md` as the authoritative architectural and process reference and `PROGRESS.md` as the canonical sprint/status tracker. When making changes:

- Update `PROGRESS.md` for sprint-level progress, percent complete, and task lists (small, frequent updates).
- Update `MASTER_DOCUMENTATION.md` for architectural changes, process updates, or when adding major new helpers or test patterns.
- Document shared test utilities in `MASTER_DOCUMENTATION.md` (see `tests/utils/testUtils.ts`) and add usage examples in new or updated integration tests.

Small doc fixes in other files (README, API_DOCS_GUIDE) are okay but prefer linking to the master doc for authoritative content.

This keeps tracking consistent and avoids duplicate or diverging documentation.

## License

This is a proprietary project. For contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Pre-commit checks (Husky)

This repository uses Husky to run pre-commit checks to help keep the codebase healthy.

What the pre-commit hook runs:
- `npm run typecheck` — ensure there are no TypeScript errors
- `npx lint-staged` — runs ESLint + Prettier on staged files

How to enable locally (one-time):

```bash
# install dev deps
npm ci
# install husky hooks (prepare script runs on npm install, or run manually)
npm run prepare
```

If you prefer not to run typechecking locally on every commit, you can temporarily bypass Husky with:

```bash
# Bypass pre-commit hooks for a single commit
GIT_PARAMS= git commit -m "WIP" --no-verify
```

CI will still run typecheck + tests on PRs, so do not rely on bypassing hooks as a replacement for fixing issues.
