import assert from "node:assert/strict";
import test from "node:test";

import { isAPIRouteChatModel } from "./apiRouteModels.ts";

test("API Route accepts optional string metadata and missing or undefined fields", () => {
  for (const metadata of [
    {},
    { name: undefined, description: undefined },
    { name: "GPT 6.1 Sol", description: "Chat model" },
    { name: "", description: "" },
  ]) {
    const model = { id: "gpt-6.1-sol", ...metadata };
    assert.equal(isAPIRouteChatModel(model), true);
    if (isAPIRouteChatModel(model)) {
      assert.doesNotThrow(() => model.description?.slice(0, 100));
    }
  }
});

test("API Route rejects malformed optional metadata before rendering", () => {
  for (const field of ["name", "description"]) {
    for (const value of [42, {}, [], null, true]) {
      assert.equal(
        isAPIRouteChatModel({ id: "gpt-6.1-sol", [field]: value }),
        false
      );
    }
  }
});

test("API Route keeps invalid IDs and generated media out of the chat selector", () => {
  for (const model of [
    null,
    {},
    { id: 42 },
    { id: " " },
    { id: "gpt-image-1" },
    { id: "veo-3", supported_endpoint_types: ["video-generation"] },
    {
      id: "media-model",
      supported_endpoint_types: ["openai", "image-generation"],
    },
  ]) {
    assert.equal(isAPIRouteChatModel(model), false);
  }
  assert.equal(
    isAPIRouteChatModel({
      id: "gpt-6.1-sol",
      supported_endpoint_types: ["openai"],
    }),
    true
  );
});
