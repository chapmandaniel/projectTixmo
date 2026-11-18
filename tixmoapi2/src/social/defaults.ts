/** Default thresholds and keywords for org settings rows. */

export const DEFAULT_THRESHOLD_VALUES = {
  NORMAL: { multiplier: 3, minimum: 10, unansweredMinutes: 240 },
  ON_SALE_DAY: { multiplier: 2, minimum: 5, unansweredMinutes: 60 },
  EVENT_DAY: { multiplier: 1.5, minimum: 3, unansweredMinutes: 30 },
} as const;

export const DEFAULT_KEYWORD_VALUES = {
  Ticketing: ['ticket', 'qr', 'transfer', 'resale', 'sold out', 'presale code'],
  Refunds: ['refund', 'chargeback', 'money back', 'cancelled'],
  'Access/Entry': ['line', 'queue', 'entry', 'wristband', 'doors', 'bag policy'],
  Lineup: ['set time', 'cancelled set', 'headliner', 'clash'],
  Safety: ['injured', 'medical', 'crush', 'unsafe', 'harass', 'lost child'],
} as const;

export const READ_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'read_insights',
  'pages_read_user_content',
  'instagram_basic',
  'instagram_manage_insights',
  'instagram_manage_comments',
] as const;

export const dashboardThresholdLabels = (values = DEFAULT_THRESHOLD_VALUES) => ({
  NORMAL: {
    multiplier: `${Number(values.NORMAL.multiplier).toFixed(1)}×`,
    minimum: `${values.NORMAL.minimum} / h`,
    unanswered: `${Math.round(values.NORMAL.unansweredMinutes / 60)} h`,
  },
  ON_SALE_DAY: {
    multiplier: `${Number(values.ON_SALE_DAY.multiplier).toFixed(1)}×`,
    minimum: `${values.ON_SALE_DAY.minimum} / h`,
    unanswered: `${Math.round(values.ON_SALE_DAY.unansweredMinutes / 60)} h`,
  },
  EVENT_DAY: {
    multiplier: `${Number(values.EVENT_DAY.multiplier).toFixed(1)}×`,
    minimum: `${values.EVENT_DAY.minimum} / 15m`,
    unanswered: `${values.EVENT_DAY.unansweredMinutes} min`,
  },
});
