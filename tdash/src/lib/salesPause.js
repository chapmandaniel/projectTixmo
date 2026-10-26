export const SALES_PAUSED_MESSAGE = 'Ticket sales are paused for a moment. Orders and tickets you already have are safe. Please check back soon.';
export const isSalesPausedError = (error) => error?.response?.data?.errors?.code === 'SALES_PAUSED';

// The request object is retained by the caller across ambiguous failures/retries.
export const commitSalesPause = async (api, eventId, request) => {
    const acknowledgement = await api.post(`/events/${eventId}/sales-pause`, request);
    const evidence = acknowledgement?.data;
    if (evidence?.eventId !== eventId || evidence?.requestId !== request.requestId
        || evidence?.salesPaused !== request.paused) throw new Error('Sales control was not acknowledged. Retry the same request.');
    // Never apply replay evidence as current state.
    try {
        const current = await api.get(`/events/${eventId}`);
        if (typeof current?.data?.salesPaused !== 'boolean') throw new Error('Missing current sales state');
        return current.data;
    } catch {
        throw new Error('Request acknowledged, but current sales state could not be refreshed. Retry the same request.');
    }
};

export const isDefinitiveSalesControlFailure = (error) => [400, 401, 403, 404, 409, 422].includes(error?.response?.status);
export const isCurrentSalesControlResult = (captured, latest, mounted) => mounted
    && captured.event === latest.event && captured.user === latest.user;
