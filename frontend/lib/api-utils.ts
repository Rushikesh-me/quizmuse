import { NextRequest, NextResponse } from 'next/server';

/**
 * Common API response utilities for consistent error handling and responses
 */

export interface ApiError {
  error: string;
  details?: string;
  status: number;
}

export interface ApiSuccess<T = any> {
  data?: T;
  message?: string;
  status: number;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  status: number = 500,
  details?: string
): NextResponse {
  const response: ApiError = { error, status };
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status });
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response: ApiSuccess<T> = { status };
  if (data !== undefined) {
    response.data = data;
  }
  if (message) {
    response.message = message;
  }
  return NextResponse.json(response, { status });
}

/**
 * Validates required environment variables
 */
export function validateEnvVars(requiredVars: string[]): string | null {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    return `${missing.join(', ')} environment variable(s) are not set`;
  }
  return null;
}

/**
 * Validates required request body fields
 */
export function validateRequestBody(
  body: any,
  requiredFields: string[]
): string | null {
  const missing = requiredFields.filter(field => !body[field]);
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

/**
 * Wraps API route handlers with common error handling
 */
export function withErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return createErrorResponse(
        'Internal server error',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  threadId: (threadId: string) => {
    if (!threadId || typeof threadId !== 'string') {
      return 'Thread ID is required and must be a string';
    }
    return null;
  },
  
  message: (message: string) => {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return 'Message is required and cannot be empty';
    }
    return null;
  },
  
  fileCount: (files: File[], maxCount: number = 5) => {
    if (!files || files.length === 0) {
      return 'No files provided';
    }
    if (files.length > maxCount) {
      return `Too many files. Maximum ${maxCount} files allowed.`;
    }
    return null;
  },
  
  fileType: (files: File[], allowedTypes: string[]) => {
    const invalidFiles = files.filter(file => !allowedTypes.includes(file.type));
    if (invalidFiles.length > 0) {
      return `Invalid file types. Only ${allowedTypes.join(', ')} files are allowed.`;
    }
    return null;
  },
  
  fileSize: (files: File[], maxSize: number) => {
    const oversizedFiles = files.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      return `File size exceeds limit. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`;
    }
    return null;
  }
};
