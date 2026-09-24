// Every failed API call becomes one of these, so the UI can rely on
// `error.code` and `error.message` whatever went wrong.
export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message = 'Something went wrong', details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Converts an axios error into an ApiError. The server always replies with
// { success: false, error: { code, message, details? } }.
export function toApiError(error) {
  if (error instanceof ApiError) return error;

  const body = error?.response?.data?.error;
  if (body?.code) {
    return new ApiError({ status: error.response.status, ...body });
  }
  if (error?.code === 'ECONNABORTED') {
    return new ApiError({ code: 'TIMEOUT', message: 'The server took too long to respond.' });
  }
  if (!error?.response) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message: "Can't reach the server. Check your internet connection.",
    });
  }
  return new ApiError({ status: error.response.status });
}
