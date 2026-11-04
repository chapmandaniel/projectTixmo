// 409 conflict codes live on errors.code. Top-level code is the 503 busy envelope.
export const conflictCode = (error) => error?.response?.data?.errors?.code;

export const isSoldOutError = (error) =>
    error?.response?.status === 409 && conflictCode(error) === 'SOLD_OUT';

export const isEventSaleClosedError = (error) => {
    const code = conflictCode(error);
    return error?.response?.status === 409 && (code === 'EVENT_ENDED' || code === 'EVENT_UNDATED');
};
