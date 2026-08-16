/**
 * Call /api/analysis/ai and return coach comment text.
 * Supports JSON { text } (preferred) and text streams.
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
    throw new Error(
      text || `AI\u8981\u6c42\u304c\u5931\u6557\u3057\u307e\u3057\u305f (${res.status})`
    );
  }

  if (contentType.includes("application/json")) {
    const json = (await res.json()) as {
      text?: string;
      completion?: string;
      error?: string;
    };
    if (json.error) throw new Error(json.error);
    const text = (json.text ?? json.completion ?? "").trim();
    if (!text) {
      throw new Error(
        "AI\u304b\u3089\u7a7a\u306e\u5fdc\u7b54\u304c\u8fd4\u308a\u307e\u3057\u305f"
      );
    }
    params.onChunk?.(text);
    return text;
  }

  // Fallback: plain text / stream
  if (!res.body) {
    const text = (await res.text()).trim();
    if (!text) {
      throw new Error(
        "AI\u304b\u3089\u7a7a\u306e\u5fdc\u7b54\u304c\u8fd4\u308a\u307e\u3057\u305f"
      );
    }
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
  full = full.trim();
  if (!full) {
    throw new Error(
      "AI\u304b\u3089\u7a7a\u306e\u5fdc\u7b54\u304c\u8fd4\u308a\u307e\u3057\u305f"
    );
  }
  params.onChunk?.(full);
  return full;
}
