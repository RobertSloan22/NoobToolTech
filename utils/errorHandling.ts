/**
 * Utility functions for error handling with proper TypeScript typing
 */

// Define ApiError interface locally
interface ApiError extends Error {
  code?: string;
  response?: {
    status: number;
    data?: {
      message?: string;
    };
  };
  request?: any;
  message: string;
}

/**
 * Safely access the message property from an unknown error
 * @param error Any error object
 * @returns The error message string
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'string') {
    return error;
  } else if (error && typeof error === 'object') {
    // Try to handle axios-like error objects
    const errorObj = error as any;
    if (errorObj.response?.data?.message) {
      return errorObj.response.data.message;
    } else if (errorObj.message) {
      return errorObj.message;
    }
  }
  return String(error);
};

/**
 * Convert an unknown error to a typed ApiError or regular Error
 * @param error Any error object
 * @returns A properly typed error object
 */
export const toTypedError = (error: unknown): ApiError | Error => {
  if (error instanceof Error) {
    // Try to detect if it's an ApiError
    const anyError = error as any;
    if (anyError.response || anyError.request || anyError.code) {
      return error as ApiError;
    }
    return error;
  }
  
  // Convert to standard Error object
  return new Error(getErrorMessage(error));
};

/**
 * Check if the error has a specific error code
 * @param error Any error object
 * @param code The error code to check
 * @returns True if the error has the specified code
 */
export const hasErrorCode = (error: unknown, code: string): boolean => {
  if (error && typeof error === 'object') {
    const errorObj = error as any;
    return errorObj.code === code;
  }
  return false;
};

/**
 * Get the status code from an API error, if available
 * @param error Any error object
 * @returns The HTTP status code, or undefined if not available
 */
export const getErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    const errorObj = error as any;
    return errorObj.response?.status;
  }
  return undefined;
};

/**
 * Creates a formatted error message for API errors
 * @param error Any error object
 * @returns A formatted error message string
 */
export const formatApiErrorMessage = (error: unknown): string => {
  const typedError = toTypedError(error);
  
  if ('response' in typedError && typedError.response) {
    return `API error: ${typedError.response.status} - ${typedError.response.data?.message || typedError.message}`;
  } else if ('request' in typedError && typedError.request) {
    return `Network error: No response received`;
  } else {
    return `Error: ${typedError.message}`;
  }
};

/**
 * Creates a standard error object for API responses
 * @param error Any error object
 * @returns An object with error message and code
 */
export const createErrorObject = (error: unknown): { error: string; code?: string } => {
  const typedError = toTypedError(error);
  
  return {
    error: typedError.message,
    code: 'code' in typedError ? typedError.code : undefined
  };
}; 