/**
 * Call /api/analysis/ai and stream plain text into onChunk.
 * Returns the full text. Throws Error with message from JSON error body when possible.
 */
export async function streamAiCoachComment(params: {
  type: "individual" | "team";
  data: Record<string, unknown>;
  onChunk?: (text: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const res = await fetch("/api/analysis/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: params.type, data: params.data }),
    signal: params.signal,
  });

  const contentType = res.headers.get("content-type") ?? "";

  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ||
          `AI\u8981\u6c42\u304c\u5931\u6557\u3057\u307e\u3057\u305f (${res.status})`
      );
    }
    const text = await res.text();
    throw new Error(text || `AI\u8981\u6c42\u304c\u5931\u6557\u3057\u307e\u3057\u305f (${res.status})`);
  }

  // Non-stream JSON (unexpected success shape)
  if (contentType.includes("application/json")) {
    const json = await res.json();
    const text =
      typeof json === "string"
        ? json
        : (json.text ?? json.completion ?? JSON.stringify(json));
    params.onChunk?.(text);
    return text;
  }

  if (!res.body) {
    const text = await res.text();
    params.onChunk?.(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    params.onChunk?.(full);
  }
  full += decoder.decode();
  params.onChunk?.(full);
  return full;
}
