import { redirect } from "next/navigation";
import toast from "@/lib/toast";

export interface ApiErrorResponse {
  error: string;
  code?: string;
}

export async function handleApiError(response: Response): Promise<never> {
  const contentType = response.headers.get("content-type");
  let errorMessage = "An error occurred";

  if (contentType?.includes("application/json")) {
    try {
      const data: ApiErrorResponse = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
  }

  switch (response.status) {
    case 401:
      toast.error("Session expired. Please login again.");
      redirect("/login");
      break;
    case 403:
      toast.error("You don't have permission to perform this action");
      throw new Error("Permission denied");
    case 404:
      toast.error("Resource not found");
      throw new Error("Not found");
    case 500:
      toast.error("Server error. Please try again later.");
      throw new Error("Server error");
    default:
      toast.error(errorMessage);
      throw new Error(errorMessage);
  }
}

export async function fetchApi<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      toast.error("Network error. Please check your connection.");
      throw new Error("Network error");
    }
    throw error;
  }
}
