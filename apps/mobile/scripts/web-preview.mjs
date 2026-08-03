import * as NodeChildProcess from "node:child_process";
import * as NodeHttp from "node:http";
import httpProxy from "http-proxy";

const requestedPortIndex = process.argv.indexOf("--port");
const previewPort = Number(
  requestedPortIndex >= 0 ? process.argv[requestedPortIndex + 1] : process.env.PORT || 8081,
);

if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65_534) {
  throw new Error(`Invalid preview port: ${previewPort}`);
}

const metroPort = previewPort + 1;
const metroOrigin = `http://127.0.0.1:${metroPort}`;
const childEnvironment = {
  ...process.env,
  BROWSER: "none",
  EXPO_PUBLIC_PEACOCKERY_VOICE_API_KEY:
    process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_API_KEY ?? process.env.PEACOCKERY_VOICE_LAB_API_KEY,
  EXPO_PUBLIC_PEACOCKERY_VOICE_MODEL:
    process.env.EXPO_PUBLIC_PEACOCKERY_VOICE_MODEL ?? process.env.VOICE_ASR_MODEL,
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

const server = NodeHttp.createServer((request, response) => {
  proxy.web(request, response);
});

server.on("upgrade", (request, socket, head) => {
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
