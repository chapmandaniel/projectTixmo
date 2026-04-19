# Dashboard Design System

This dashboard now has an explicit design-system layer. New work should extend that layer, not reintroduce one-off shell styling in feature files.

## Source Of Truth

- Tokens live in `src/lib/dashboardTheme.js` and `tailwind.config.js`.
- Shared dashboard primitives live in `src/components/dashboard/DashboardPrimitives.jsx`.
- Global font/background primitives live in `src/index.css`.

## Use These Primitives

- `DashboardPage`
- `DashboardPageHeader`
- `DashboardSection`
- `DashboardSurface`
- `DashboardChip`
- `DashboardStat`
- `DashboardEmptyState`
- `DashboardIconButton`
- `DashboardModuleTile`

## Rules

- Do not add raw dashboard hex values in feature, page, layout, or non-system component files.
- Do not add arbitrary Tailwind color utilities like `bg-[#...]`, `text-[#...]`, or `border-[#...]` outside the design-system layer.
- If a new page needs a new surface, button, badge, stat, or empty state pattern, add it to `DashboardPrimitives.jsx` first and then consume it from the page.
- Prefer token names and theme helpers over hard-coded color choices.
- Keep page structure consistent: page shell, header, sections, then specialized content.

## Guardrail

- Run `npm run design:guard` inside `tdash` to check for new violations.
- Run `npm run design:guard:update` only when intentionally accepting or clearing the tracked baseline.
- The guard is baseline-backed so it blocks new regressions without requiring a full legacy cleanup in one pass.

## Review Checklist

- Uses dashboard primitives instead of ad hoc surface classes.
- Uses theme tokens instead of raw dashboard hex values.
- New patterns were extracted into the design-system layer.
- Page hierarchy matches the existing dashboard shell.
