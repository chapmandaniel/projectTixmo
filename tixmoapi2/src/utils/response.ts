interface SuccessResponse {
  success: true;
  data?: unknown;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export const successResponse = (
  data?: unknown,
  message?: string,
  meta?: SuccessResponse['meta']
): SuccessResponse => {
  const response: SuccessResponse = {
    success: true,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};
