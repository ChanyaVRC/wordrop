// Thin wrappers around the server API. The answer never crosses this boundary — these
// calls only ever return an id, a session token, or per-guess colors.

export type Mark = "correct" | "present" | "absent";

export interface CreateResponse {
  id: string;
}
export interface StartResponse {
  token: string;
  attemptsLeft: number;
  maxAttempts: number;
}
export interface GuessResponse {
  feedback: Mark[];
  solved: boolean;
  attemptsLeft: number;
  token: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new ApiError(
      (data && data.message) || `http_${res.status}`,
      res.status,
      data && data.error
    );
  }
  return data as T;
}

export function createPuzzle(word: string): Promise<CreateResponse> {
  return postJson("/api/create", { word });
}

export function createRandom(): Promise<CreateResponse> {
  return postJson("/api/create", { random: true });
}

export function startGame(id: string): Promise<StartResponse> {
  return postJson("/api/start", { id });
}

export function submitGuess(token: string, guess: string): Promise<GuessResponse> {
  return postJson("/api/guess", { token, guess });
}
