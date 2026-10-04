type ApiSuccess<T> = { success: true; data: T };
type ApiFailure = { success: false; message: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  const body = (await response.json().catch(() => ({
    success: false,
    message: "The server returned an unreadable response.",
  }))) as ApiResponse<T>;

  if (!response.ok && body.success) {
    return { success: false, message: "The request failed." };
  }

  return body;
}
