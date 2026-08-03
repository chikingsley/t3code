import * as NodeChildProcess from "node:child_process";

const SERVICE_NAME = "t3code-mobile-web.service";
const TUNNEL_NAME = "t3code-mobile";
const LOCAL_URL = "http://127.0.0.1:18181";
const PUBLIC_URL = "https://t3code-mobile.grassinside.com";

function run(command, args, options = {}) {
  const result = NodeChildProcess.spawnSync(command, args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (!options.allowFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

async function responds(url) {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForLocalPreview() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await responds(LOCAL_URL)) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Preview did not become ready at ${LOCAL_URL}.`);
}

async function up() {
  run("systemctl", ["--user", "start", SERVICE_NAME]);
  await waitForLocalPreview();
  run("tunnel", ["up", "18181", "--name", TUNNEL_NAME]);
  if (!(await responds(PUBLIC_URL))) {
    throw new Error(`Tunnel verification failed at ${PUBLIC_URL}.`);
  }
  console.log(`Mobile preview: ${PUBLIC_URL}`);
  console.log("Stop the complete preview stack with: pnpm --filter @t3tools/mobile web:stack:down");
}

function down() {
  run("tunnel", ["ls"]);
  run("tunnel", ["down", TUNNEL_NAME], { allowFailure: true });
  run("systemctl", ["--user", "stop", SERVICE_NAME]);
  console.log("Mobile preview service and tunnel route stopped.");
}

async function status() {
  const enabled = run("systemctl", ["--user", "is-enabled", SERVICE_NAME], {
    allowFailure: true,
    capture: true,
  }).stdout.trim();
  const active = run("systemctl", ["--user", "is-active", SERVICE_NAME], {
    allowFailure: true,
    capture: true,
  }).stdout.trim();
  const local = await responds(LOCAL_URL);
  const publicRoute = await responds(PUBLIC_URL);
  console.log(`Service: ${active || "unknown"} (${enabled || "unknown"} at login)`);
  console.log(`Local: ${local ? "ready" : "unavailable"} — ${LOCAL_URL}`);
  console.log(`Public: ${publicRoute ? "ready" : "unavailable"} — ${PUBLIC_URL}`);
}

const action = process.argv[2];
if (action === "up") await up();
else if (action === "down") down();
else if (action === "status") await status();
else throw new Error("Usage: web-preview-stack.mjs <up|down|status>");
