# Dashboard Home Truth

The attached dashboard screenshot is the source of truth for:

- `src/features/DashboardHome.jsx`
- `src/layouts/DashboardLayout.jsx`

These files are an exception to the general design-system abstraction rule. They
must match the screenshot literally before they are considered correct.

## Default Home State

- Top row order is `Event Manager`, `Task Manager`, `QuantMo`, `Analytics`.
- `Team Members` and `Settings` are hidden by default.
- Visible cards show the favorite heart in the bottom-right.
- Visible cards do not show the eye control until hover.
- Hidden cards show both the hide/show eye control and the heart control.

## Visual Rules

- Use the screenshot spacing and proportions as the baseline, not a "close"
  semantic approximation.
- Home cards should use the darker dashboard panel treatment, not a bright or
  high-contrast border.
- The shell/header rhythm is part of the truth spec and should not be reinterpreted
  during design-system refactors.

## Change Rule

If this screen is intentionally redesigned:

1. Update the screenshot truth first.
2. Update `src/lib/dashboardTruth.js`.
3. Update `src/test/DashboardTruth.test.jsx`.
