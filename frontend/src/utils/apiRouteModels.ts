/** API Route exposes chat and generated-media models in one catalogue. */
export function isAPIRouteChatModel(model: unknown): model is {
  id: string;
  name?: string;
  description?: string;
} {
  if (!model || typeof model !== "object" || !("id" in model)) {
    return false;
  }
  if (typeof model.id !== "string" || !model.id.trim()) {
    return false;
  }
  if (
    ("name" in model &&
      model.name !== undefined &&
      typeof model.name !== "string") ||
    ("description" in model &&
      model.description !== undefined &&
      typeof model.description !== "string")
  ) {
    return false;
  }
  if ("supported_endpoint_types" in model) {
    const endpoints = model.supported_endpoint_types;
    if (
      Array.isArray(endpoints) &&
      (!endpoints.includes("openai") ||
        endpoints.includes("image-generation") ||
        endpoints.includes("video-generation"))
    ) {
      return false;
    }
  }
  const name = model.id.split("/").pop() ?? model.id;
  return (
    !/^(gpt-image|dall-e|imagen|nano-banana|sora|veo|seedance|flux)/i.test(
      name
    ) && !name.includes("image-preview")
  );
}
