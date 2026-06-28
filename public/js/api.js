// Thin wrappers around the server API. The answer never crosses this boundary — these
// calls only ever return an id, a session token, or per-guess colors.

async function postJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `http_${res.status}`);
    err.status = res.status;
    err.message = (data && data.message) || err.message;
    err.code = data && data.error;
    throw err;
  }
  return data;
}

export function createPuzzle(word) {
  return postJson("/api/create", { word });
}

export function createRandom() {
  return postJson("/api/create", { random: true });
}

export function startGame(id) {
  return postJson("/api/start", { id });
}

export function submitGuess(token, guess) {
  return postJson("/api/guess", { token, guess });
}
