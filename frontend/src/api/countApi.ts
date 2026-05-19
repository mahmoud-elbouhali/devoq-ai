import type {
  CountEngineInfo,
  CountErrorResponse,
  CountRequestPayload,
  CountResponse,
} from "@/types/count";

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
}

async function parseError(response: Response): Promise<never> {
  let payload: CountErrorResponse | null = null;

  try {
    payload = await response.json() as CountErrorResponse;
  } catch {
    // ignored
  }

  const error = new Error(payload?.message || `HTTP ${response.status}`);
  (error as Error & { code?: string; details?: unknown }).code = payload?.error;
  (error as Error & { code?: string; details?: unknown }).details = payload?.details;
  throw error;
}

export async function fetchHealth(): Promise<{ status: string; service: string; mode: string }> {
  const response = await fetch(`${getApiBaseUrl()}/health`);
  if (!response.ok) {
    await parseError(response);
  }
  return response.json();
}

export async function fetchEngineInfo(): Promise<CountEngineInfo> {
  const response = await fetch(`${getApiBaseUrl()}/v1/info`);
  if (!response.ok) {
    await parseError(response);
  }
  return response.json();
}

export async function postCount(payload: CountRequestPayload): Promise<CountResponse> {
  const response = await fetch(`${getApiBaseUrl()}/v1/count`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseError(response);
  }

  return response.json();
}
