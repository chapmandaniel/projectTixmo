export const isDisputedOrder = (order) => {
    const refundStatus = order?.refundStatus || '';
    return refundStatus === 'DISPUTED' || refundStatus.startsWith('DISPUTE_');
};

export const orderListStatus = (order) => (isDisputedOrder(order) ? 'DISPUTED' : order?.status);

export const disputeOutcomeLabel = (order) => {
    const refundStatus = order?.refundStatus || '';
    if (refundStatus === 'DISPUTED') return 'open';
    if (!refundStatus.startsWith('DISPUTE_')) return '';
    return refundStatus.slice('DISPUTE_'.length).toLowerCase().replaceAll('_', ' ');
};
