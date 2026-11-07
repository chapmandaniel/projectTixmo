/** Keep this list identical to tixmoapi2/src/services/ticketing-mode.ts. */
export const VENDOR_ALLOWED_CAPABILITIES = [
    'event_page',
    'venues',
    'approvals',
    'assets',
    'tasks',
    'analytics',
];

export const isExternalTicketing = (event) => event?.ticketingMode === 'EXTERNAL';

/** Unknown capabilities stay off for vendor-sold events. */
export const vendorEventAllows = (event, capability) => {
    if (!isExternalTicketing(event)) return true;
    return VENDOR_ALLOWED_CAPABILITIES.includes(capability);
};

export const externalPurchaseUrl = (event) => (
    typeof event?.externalPurchaseUrl === 'string' ? event.externalPurchaseUrl : ''
);
