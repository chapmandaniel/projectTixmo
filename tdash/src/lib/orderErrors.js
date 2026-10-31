export const isSoldOutError = (error) =>
    error?.response?.status === 409 && error?.response?.data?.errors?.code === 'SOLD_OUT';
