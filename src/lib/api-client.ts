import { redirect } from "next/navigation";
import toast from "@/lib/toast";

export interface ApiErrorResponse {
  error: string;
  code?: string;
  retryAfter?: number;
}

export interface FetchApiOptions extends RequestInit {
  /**
   * Whether to show toast notifications on error (default: true)
   */
  showErrorToast?: boolean;
  
  /**
   * Number of retry attempts for failed requests (default: 0)
   */
  retries?: number;
  
  /**
   * Delay between retries in milliseconds (default: 1000)
   */
  retryDelay?: number;
  
  /**
   * HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504])
   */
  retryOn?: number[];
  
  /**
   * Whether to automatically parse JSON response (default: true)
   */
  parseJson?: boolean;
}

export async function handleApiError(
  response: Response,
  showToast = true
): Promise<never> {
  const contentType = response.headers.get("content-type");
  let errorMessage = "An error occurred";
  let errorCode: string | undefined;

  if (contentType?.includes("application/json")) {
    try {
      const data: ApiErrorResponse = await response.json();
      errorMessage = data.error || errorMessage;
      errorCode = data.code;
    } catch {
      // Ignore JSON parse errors
    }
  }

  switch (response.status) {
    case 401:
      if (showToast) {
        toast.error("Session expired. Please login again.");
      }
      redirect("/login");
      break;
    case 403:
      if (showToast) {
        toast.error("You don't have permission to perform this action");
      }
      throw new Error("Permission denied");
    case 404:
      if (showToast) {
        toast.error("Resource not found");
      }
      throw new Error("Not found");
    case 429:
      if (showToast) {
        if (errorCode === "CONCURRENT_LIMIT_HIT") {
          toast.error("Too many concurrent requests. Please wait a moment.");
        } else {
          toast.error("Too many requests. Please slow down.");
        }
      }
      throw new Error(errorMessage);
    case 500:
      if (showToast) {
        toast.error("Server error. Please try again later.");
      }
      throw new Error("Server error");
    default:
      if (showToast) {
        toast.error(errorMessage);
      }
      throw new Error(errorMessage);
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Enhanced fetch wrapper with automatic error handling, retries, and type safety.
 * 
 * Features:
 * - Automatic JSON parsing
 * - Consistent error handling with toast notifications
 * - Retry logic for transient failures
 * - Type-safe responses
 * - Request interceptors (headers, auth)
 * 
 * @param url - The API endpoint URL
 * @param options - Fetch options with additional retry/error handling config
 * @returns Typed response data
 * 
 * @example
 * ```typescript
 * // Simple GET request
 * const tasks = await fetchApi<Task[]>('/api/tasks');
 * 
 * // POST with data
 * const newTask = await fetchApi<Task>('/api/tasks', {
 *   method: 'POST',
 *   body: JSON.stringify({ name: 'New Task' }),
 * });
 * 
 * // With retry logic
 * const data = await fetchApi<Data>('/api/expensive-operation', {
 *   retries: 3,
 *   retryDelay: 2000,
 * });
 * 
 * // Silent errors (no toast)
 * const result = await fetchApi<Result>('/api/check', {
 *   showErrorToast: false,
 * });
 * ```
 */
export async function fetchApi<T>(
  url: string,
  options?: FetchApiOptions
): Promise<T> {
  const {
    showErrorToast = true,
    retries = 0,
    retryDelay = 1000,
    retryOn = [408, 429, 500, 502, 503, 504],
    parseJson = true,
    ...fetchOptions
  } = options || {};

  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          "Content-Type": "application/json",
          ...fetchOptions?.headers,
        },
      });

      // Check if we should retry based on status code
      if (!response.ok && attempt < retries && retryOn.includes(response.status)) {
        attempt++;
        
        // Check for Retry-After header (429 responses)
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay;
        
        console.warn(`Request failed with ${response.status}, retrying in ${waitTime}ms (attempt ${attempt}/${retries})`);
        await sleep(waitTime);
        continue;
      }

      if (!response.ok) {
        await handleApiError(response, showErrorToast);
      }

      if (parseJson) {
        return await response.json();
      } else {
        return response as unknown as T;
      }
    } catch (error) {
      lastError = error as Error;

      // Network errors - retry if configured
      if (
        error instanceof TypeError &&
        error.message === "Failed to fetch" &&
        attempt < retries
      ) {
        attempt++;
        console.warn(`Network error, retrying in ${retryDelay}ms (attempt ${attempt}/${retries})`);
        await sleep(retryDelay);
        continue;
      }

      // Re-throw for redirect errors or when out of retries
      if (showErrorToast && error instanceof TypeError && error.message === "Failed to fetch") {
        toast.error("Network error. Please check your connection.");
      }
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error("Request failed after retries");
}

/**
 * Simplified GET request helper
 */
export async function get<T>(url: string, options?: FetchApiOptions): Promise<T> {
  return fetchApi<T>(url, { ...options, method: "GET" });
}

/**
 * Simplified POST request helper
 */
export async function post<T>(
  url: string,
  data?: unknown,
  options?: FetchApiOptions
): Promise<T> {
  return fetchApi<T>(url, {
    ...options,
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Simplified PUT request helper
 */
export async function put<T>(
  url: string,
  data?: unknown,
  options?: FetchApiOptions
): Promise<T> {
  return fetchApi<T>(url, {
    ...options,
    method: "PUT",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Simplified PATCH request helper
 */
export async function patch<T>(
  url: string,
  data?: unknown,
  options?: FetchApiOptions
): Promise<T> {
  return fetchApi<T>(url, {
    ...options,
    method: "PATCH",
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Simplified DELETE request helper
 */
export async function del<T>(url: string, options?: FetchApiOptions): Promise<T> {
  return fetchApi<T>(url, { ...options, method: "DELETE" });
}
