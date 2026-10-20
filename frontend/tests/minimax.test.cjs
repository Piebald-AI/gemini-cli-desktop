const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const axios = require("axios");

// Execute the real TS/TSX settings, persistence, hook and transport modules.
// UI primitives and hook scheduling are mocked; Axios serializes the HTTP body.
function harness({ saved, web = true, catalog = [] } = {}) {
  const requests = [];
  const storage = new Map(
    saved ? [["backend-state", JSON.stringify(saved)]] : []
  );
  let active;
  const component = (render) => {
    const slots = [];
    const effects = [];
    return () => {
      active = { slots, effects, cursor: 0 };
      const result = render();
      effects.splice(0).forEach((effect) => effect());
      return result;
    };
  };
  const react = {
    useState(initial) {
      const owner = active;
      const index = owner.cursor++;
      if (!(index in owner.slots))
        owner.slots[index] =
          typeof initial === "function" ? initial() : initial;
      return [
        owner.slots[index],
        (value) => {
          owner.slots[index] =
            typeof value === "function" ? value(owner.slots[index]) : value;
        },
      ];
    },
    useReducer(reducer, initial, initialize) {
      const [value, setValue] = react.useState(() =>
        initialize ? initialize(initial) : initial
      );
      return [value, (action) => setValue((state) => reducer(state, action))];
    },
    useRef(value) {
      return react.useState({ current: value })[0];
    },
    useCallback(fn) {
      return fn;
    },
    useMemo(fn) {
      return fn();
    },
    useEffect(fn, deps) {
      const index = active.cursor++;
      if (
        !active.slots[index] ||
        deps.some((dep, i) => dep !== active.slots[index][i])
      ) {
        active.slots[index] = deps;
        active.effects.push(fn);
      }
    },
    createContext() {
      return { Provider: "ContextProvider" };
    },
  };
  const jsx = (type, props) => ({ type, props });
  const primitives = new Proxy({}, { get: (_, name) => name });
  let backend;
  let selectedModel;
  const update = (changes) => backend.updateConfig("llxprt", changes);
  const transport = axios.create({
    adapter: async (config) => {
      requests.push({
        url: config.url,
        baseURL: config.baseURL,
        method: config.method,
        body: JSON.parse(config.data),
      });
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    },
  });
  const context = {
    useBackend: () => backend,
    useBackendConfig: (name) => ({
      config: backend.state.configs[name],
      updateConfig: name === "llxprt" ? update : () => {},
    }),
  };
  const stubs = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-i18next": {
      useTranslation: () => ({
        t: (key) => key,
        i18n: { language: "en", changeLanguage() {} },
      }),
    },
    "@/i18n": { supportedLanguages: ["en"], languageNames: { en: "English" } },
    axios: {
      ...axios,
      create: (options) =>
        axios.create({ ...options, adapter: transport.defaults.adapter }),
    },
    "@tauri-apps/api/core": {
      invoke: async (command, args) => {
        requests.push({ command, body: JSON.parse(JSON.stringify(args)) });
      },
    },
    sonner: {
      toast: {
        error: (error) => {
          throw new Error(error);
        },
        success() {},
      },
    },
    "@/contexts/BackendContext": context,
    "../contexts/BackendContext": context,
    "@/lib/utils": {
      cn: (...values) =>
        values.filter((value) => typeof value === "string").join(" "),
    },
    "lucide-react": primitives,
    "@/components/ui/button": primitives,
    "@/components/ui/input": primitives,
    "@/components/ui/dialog": primitives,
    "@/components/ui/select": primitives,
    "@/components/ui/checkbox": primitives,
    "@/components/ui/tooltip": primitives,
    "@/components/ui/command": primitives,
  };
  const timers = [];
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(__dirname, "../src", relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      const target = name.startsWith("@/")
        ? name.slice(2)
        : path.relative(
            path.resolve(__dirname, "../src"),
            path.resolve(path.dirname(filename), name)
          );
      return load(`${target}.ts`);
    };
    new Function(
      "require",
      "module",
      "exports",
      "__WEB__",
      "localStorage",
      "setTimeout",
      "clearTimeout",
      "fetch",
      "document",
      "console",
      source
    )(
      localRequire,
      module,
      module.exports,
      web,
      {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      (fn, delay) => {
        if (delay < 1000) timers.push(fn);
        return timers.length;
      },
      () => {},
      async () => ({ ok: true, json: async () => ({ data: catalog }) }),
      { addEventListener() {}, removeEventListener() {} },
      { ...console, log() {} }
    );
    return module.exports;
  }
  const { BackendProvider } = load("contexts/BackendContext.tsx");
  const renderBackend = component(
    () => BackendProvider({ children: null }).props.value
  );
  const refresh = () => {
    backend = renderBackend();
    return backend;
  };
  refresh();
  backend.switchBackend("llxprt");
  refresh();
  selectedModel = backend.currentModel;
  const { SettingsDialog } = load("components/common/SettingsDialog.tsx");
  const renderSettings = component(() =>
    SettingsDialog({
      open: true,
      onOpenChange() {},
      onModelChange: (model) => {
        selectedModel = model;
      },
    })
  );
  const settings = () => {
    refresh();
    return renderSettings();
  };
  const find = (tree, predicate) => {
    if (!tree || typeof tree !== "object") return undefined;
    if (Array.isArray(tree))
      return tree.map((child) => find(child, predicate)).find(Boolean);
    if (predicate(tree)) return tree;
    return find(tree.props?.children, predicate);
  };
  const selectProvider = (name) => {
    const select = find(
      settings(),
      (node) =>
        node.type === "Select" &&
        node.props.value === backend.state.configs.llxprt.provider
    );
    assert.ok(select, "provider selector is rendered");
    select.props.onValueChange(name);
    refresh();
  };
  const send = async (message = "Hello @image.png") => {
    refresh();
    const { useMessageHandler } = load("hooks/useMessageHandler.ts");
    const renderHook = component(() =>
      useMessageHandler({
        activeConversation: null,
        conversations: [],
        selectedModel,
        isCliInstalled: true,
        updateConversation(_id, fn) {
          fn({ messages: [] });
        },
        createNewConversation() {},
        setActiveConversation() {},
        setupEventListenerForConversation: async () => () => {},
        fetchProcessStatuses: async () => {},
      })
    );
    renderHook().setInput(message);
    await renderHook().handleSendMessage({ preventDefault() {} });
    return requests;
  };
  return {
    load,
    settings,
    find,
    selectProvider,
    update,
    refresh,
    send,
    requests,
    storage,
    flushTimers: async () => {
      for (const fn of timers.splice(0)) await fn();
    },
  };
}

test("fresh MiniMax selection offers Flash first and M3; all regions/protocols reach serialized requests", async () => {
  for (const web of [true, false]) {
    for (const region of ["global", "cn"]) {
      for (const apiFormat of ["openai", "anthropic"]) {
        const app = harness({ web });
        app.selectProvider("minimax");
        app.update({ region, apiFormat });
        const list = app.find(
          app.settings(),
          (node) => node.type === "datalist"
        );
        assert.deepEqual(
          list.props.children.map((node) => node.props.value),
          ["MiniMax-M3.1-Flash", "MiniMax-M3"]
        );
        const [request, message] = await app.send();
        const config = request.body.llxprtConfig;
        assert.equal(request.body.model, "MiniMax-M3.1-Flash");
        assert.equal(config.model, "MiniMax-M3.1-Flash");
        assert.equal(
          config.provider,
          apiFormat === "anthropic" ? "minimax-anthropic" : "minimax"
        );
        assert.equal(
          config.base_url,
          `https://${region === "global" ? "api.minimax.io" : "api.minimaxi.com"}/${apiFormat === "openai" ? "v1" : "anthropic"}`
        );
        if (web) {
          assert.equal(request.baseURL, "/api");
          assert.equal(request.url, "/start-session");
          assert.equal(request.method, "post");
        } else assert.equal(request.command, "start_session");
        assert.equal(message.body.message, "Hello @image.png");
        for (const unsupported of [
          "thinking",
          "reasoning_effort",
          "output_config",
          "service_tier",
          "reasoning_split",
        ])
          assert.equal(Object.hasOwn(config, unsupported), false);
      }
    }
  }
});

test("saved M3, legacy and custom IDs survive loading, settings and request serialization", async () => {
  for (const model of ["MiniMax-M3", "MiniMax-M2.7", "custom-minimax-model"]) {
    const app = harness({
      saved: {
        selectedBackend: "llxprt",
        configs: {
          llxprt: {
            provider: "minimax",
            model,
            region: "cn",
            apiFormat: "anthropic",
          },
        },
      },
    });
    assert.ok(
      app.find(
        app.settings(),
        (node) => node.type === "Input" && node.props.value === model
      )
    );
    const [request] = await app.send();
    assert.equal(request.body.llxprtConfig.model, model);
    assert.equal(request.body.model, model);
    assert.equal(
      JSON.parse(app.storage.get("backend-state")).configs.llxprt.model,
      model
    );
  }
  const app = harness();
  app.selectProvider("minimax");
  const input = app.find(
    app.settings(),
    (node) => node.type === "Input" && node.props.list === "minimax-models"
  );
  input.props.onChange({ target: { value: "manually-entered-legacy" } });
  assert.equal(
    (await app.send())[0].body.llxprtConfig.model,
    "manually-entered-legacy"
  );
});

test("OpenRouter picker filters ordinary MiniMax text suggestions and sends the verified Flash route", async () => {
  const models = [
    { id: "other/model", name: "Other" },
    { id: "minimax/minimax-m2.7", name: "Legacy" },
    { id: "minimax/minimax-m3", name: "M3", context_length: 1048576 },
    {
      id: "minimax/minimax-m3.1-flash:free",
      name: "Flash",
      context_length: 1000000,
    },
    { id: "minimax/minimax-m3.1-flash", name: "Unverified suffix" },
    { id: "minimax/minimax-01", name: "Old text" },
    { id: "minimax/speech-02-hd", name: "Speech" },
    { id: "minimax/video-01", name: "Video" },
  ];
  const app = harness({ catalog: models });
  const { filterProviderModels } = app.load("utils/providerConfig.ts");
  assert.deepEqual(filterProviderModels("openrouter", models), [
    models[3],
    models[2],
    models[0],
    models[6],
    models[7],
  ]);
  assert.equal(filterProviderModels("custom", models), models);
  app.selectProvider("openrouter");
  app.update({ apiKey: "offline-test-key" });
  const fetchButton = app.find(
    app.settings(),
    (node) =>
      node.type === "Button" &&
      Array.isArray(node.props.children) &&
      node.props.children.includes("Fetch Models")
  );
  fetchButton.props.onClick();
  await app.flushTimers();
  const combo = app.find(
    app.settings(),
    (node) => node.props?.role === "combobox"
  );
  assert.ok(combo);
  combo.props.onClick();
  const tree = app.settings();
  assert.equal(
    app.find(
      tree,
      (node) => node.type === "CommandItem" && node.props.value === "Legacy"
    ),
    undefined
  );
  const flash = app.find(
    tree,
    (node) => node.type === "CommandItem" && node.props.value === "Flash"
  );
  assert.ok(flash);
  flash.props.onSelect();
  assert.equal(
    (await app.send())[0].body.llxprtConfig.model,
    "minimax/minimax-m3.1-flash:free"
  );
  app.update({ model: "minimax/minimax-m2.7" });
  assert.equal(
    (await app.send())[2].body.llxprtConfig.model,
    "minimax/minimax-m2.7"
  );
});

test("other providers retain their model and custom endpoint requests are unchanged", async () => {
  const app = harness();
  app.update({ model: "explicit-other-model" });
  app.selectProvider("openai");
  assert.equal(
    app.refresh().state.configs.llxprt.model,
    "explicit-other-model"
  );
  app.selectProvider("anthropic");
  assert.equal(
    app.refresh().state.configs.llxprt.model,
    "explicit-other-model"
  );
  app.selectProvider("custom");
  app.update({ model: "my-model", baseUrl: "https://example.invalid/v1" });
  const [request] = await app.send();
  assert.equal(request.body.llxprtConfig.provider, "custom");
  assert.equal(request.body.llxprtConfig.model, "my-model");
  assert.equal(
    request.body.llxprtConfig.base_url,
    "https://example.invalid/v1"
  );
});
