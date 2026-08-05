import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeHttp from "node:http";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import httpProxy from "http-proxy";

for (const environmentPath of [
  NodePath.resolve(process.cwd(), ".env.local"),
  NodePath.resolve(process.cwd(), "../../.env.local"),
]) {
  if (NodeFS.existsSync(environmentPath)) {
    process.loadEnvFile(environmentPath);
    break;
  }
}

const requestedPortIndex = process.argv.indexOf("--port");
const previewPort = Number(
  requestedPortIndex >= 0 ? process.argv[requestedPortIndex + 1] : process.env.PORT || 8081,
);

if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65_534) {
  throw new Error(`Invalid preview port: ${previewPort}`);
}

const metroPort = previewPort + 1;
const metroOrigin = `http://127.0.0.1:${metroPort}`;
const uiLabProvidersPath = "/_ui-lab/providers";
const providerStatusCacheDir =
  process.env.T3CODE_PROVIDER_STATUS_CACHE_DIR || NodePath.join(NodeOS.homedir(), ".t3/caches");
const voiceProxyPrefix = "/peacockery-voice";
const voiceBaseUrl =
  process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_BASE_URL || "https://voice-lab.peacockery.studio";
const voiceApiKey =
  process.env.PEACOCKERY_VOICE_LAB_API_KEY ||
  process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_API_KEY ||
  "";
const childEnvironment = {
  ...process.env,
  BROWSER: "none",
  EXPO_PUBLIC_PEACOCKERY_VOICE_API_KEY: "",
  EXPO_PUBLIC_PEACOCKERY_VOICE_MODEL:
    process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_MODEL ?? process.env.VOICE_ASR_MODEL,
  EXPO_PUBLIC_T3CODE_VOICE_PROXY: voiceApiKey ? "1" : "0",
  T3CODE_MOBILE_WEB_PREVIEW: "1",
};

const metro = NodeChildProcess.spawn(
  "pnpm",
  ["exec", "expo", "start", "--web", "--clear", "--port", String(metroPort)],
  {
    env: childEnvironment,
    stdio: "inherit",
  },
);

const proxy = httpProxy.createProxyServer({
  target: metroOrigin,
  ws: true,
});
const voiceProxy = httpProxy.createProxyServer({
  changeOrigin: true,
  secure: true,
  target: voiceBaseUrl,
  ws: true,
});

proxy.on("proxyRes", (response) => {
  response.headers["cross-origin-embedder-policy"] = "credentialless";
  response.headers["cross-origin-opener-policy"] = "same-origin";
});

proxy.on("error", (error, _request, response) => {
  if (response && "writeHead" in response && !response.headersSent) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Metro is starting: ${error.message}`);
  }
});

voiceProxy.on("error", (error, _request, response) => {
  if (response && "writeHead" in response && !response.headersSent) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end(`Voice preview bridge failed: ${error.message}`);
  }
});

const isVoiceRequest = (request) => request.url?.startsWith(`${voiceProxyPrefix}/`) ?? false;
const prepareVoiceRequest = (request) => {
  request.url = request.url?.slice(voiceProxyPrefix.length) || "/";
};
const voiceProxyOptions = {
  headers: { Authorization: `Bearer ${voiceApiKey}` },
};

const readUiLabProviders = () => {
  if (!NodeFS.existsSync(providerStatusCacheDir)) return [];

  return NodeFS.readdirSync(providerStatusCacheDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .flatMap((entry) => {
      try {
        const provider = JSON.parse(
          NodeFS.readFileSync(NodePath.join(providerStatusCacheDir, entry.name), "utf8"),
        );
        if (
          typeof provider.instanceId !== "string" ||
          typeof provider.driver !== "string" ||
          !Array.isArray(provider.models)
        ) {
          return [];
        }

        return [
          {
            instanceId: provider.instanceId,
            driver: provider.driver,
            ...(typeof provider.displayName === "string"
              ? { displayName: provider.displayName }
              : {}),
            ...(typeof provider.showInteractionModeToggle === "boolean"
              ? { showInteractionModeToggle: provider.showInteractionModeToggle }
              : {}),
            ...(typeof provider.requiresNewThreadForModelChange === "boolean"
              ? { requiresNewThreadForModelChange: provider.requiresNewThreadForModelChange }
              : {}),
            enabled: provider.enabled === true,
            installed: provider.installed === true,
            version: null,
            status: provider.status,
            auth: { status: provider.auth?.status ?? "unknown" },
            checkedAt: provider.checkedAt,
            models: provider.models,
            slashCommands: [],
            skills: [],
          },
        ];
      } catch {
        return [];
      }
    })
    .sort(
      (left, right) =>
        (left.displayName ?? left.instanceId).localeCompare(
          right.displayName ?? right.instanceId,
        ) || left.instanceId.localeCompare(right.instanceId),
    );
};

const server = NodeHttp.createServer((request, response) => {
  if (request.url === uiLabProvidersPath) {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(readUiLabProviders()));
    return;
  }
  if (isVoiceRequest(request)) {
    if (!voiceApiKey) {
      response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      response.end("Voice preview credential is unavailable");
      return;
    }
    prepareVoiceRequest(request);
    voiceProxy.web(request, response, voiceProxyOptions);
    return;
  }
  proxy.web(request, response);
});

server.on("upgrade", (request, socket, head) => {
  if (isVoiceRequest(request)) {
    if (!voiceApiKey) {
      socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
      return;
    }
    prepareVoiceRequest(request);
    voiceProxy.ws(request, socket, head, voiceProxyOptions);
    return;
  }
  proxy.ws(request, socket, head);
});

server.listen(previewPort, "127.0.0.1", () => {
  console.log(`Mobile web preview: http://127.0.0.1:${previewPort}`);
  console.log(`Metro origin: ${metroOrigin}`);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  voiceProxy.close();
  metro.kill("SIGINT");
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

metro.once("exit", (code, signal) => {
  server.close(() => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
});
