import "server-only";
import { Sandbox } from "@vercel/sandbox";

/**
 * Sandbox orchestrator: the only file that knows which provider runs user code (Vercel Sandbox — a Firecracker microVM).
 * Swapping to E2B / Modal / self-hosted Firecracker means rewriting these few functions, nothing else.
 */
export const APP_DIR = "/vercel/sandbox/app";
const PORT = 3000;

/** On Vercel the SDK authenticates with the project's OIDC token; locally `vercel env pull` provides VERCEL_OIDC_TOKEN. */
export const sandboxesEnabled = () => !!process.env.VERCEL || !!process.env.VERCEL_OIDC_TOKEN;

export async function createSandbox() {
  // ponytail: npm install on every new sandbox (~15s); a pre-installed template snapshot (Sandbox.create from a snapshot) makes it ~1s.
  return Sandbox.create({ ports: [PORT], timeout: 30 * 60 * 1000, resources: { vcpus: 2 } });
}

export const getSandbox = (name: string) => Sandbox.get({ name }); // a stopped sandbox resumes on its next command

export async function writeFiles(sb: Sandbox, files: { path: string; content: string }[]) {
  await sb.writeFiles(files.map((f) => ({ path: `${APP_DIR}/${f.path}`, content: Buffer.from(f.content) })));
}

export async function readFile(sb: Sandbox, path: string) {
  return (await sb.readFileToBuffer({ path: `${APP_DIR}/${path}` }))?.toString("utf8") ?? null;
}

/** Run a command in the app folder; output trimmed to what a model (or a person) needs to see. */
export async function run(sb: Sandbox, cmd: string, args: string[], keep = 4000) {
  const r = await sb.runCommand({ cmd, args, cwd: APP_DIR });
  const out = `${await r.stdout()}${await r.stderr()}`.replace(/\x1b\[[0-9;]*m/g, ""); // strip terminal colours
  return { ok: r.exitCode === 0, exitCode: r.exitCode, output: out.length > keep ? `…${out.slice(-keep)}` : out };
}

export async function listFiles(sb: Sandbox) {
  const r = await run(sb, "find", [".", "-type", "f", "-not", "-path", "./node_modules/*", "-not", "-path", "./dist/*", "-not", "-name", "package-lock.json"], 6000);
  return r.output.split("\n").map((l) => l.replace(/^\.\//, "").trim()).filter(Boolean).sort();
}

/** Start (or confirm) the dev server and return the public preview URL. */
export async function startPreview(sb: Sandbox) {
  const up = async () => (await run(sb, "curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", `http://localhost:${PORT}`])).output.trim() === "200";
  if (!(await up())) {
    await sb.runCommand({ cmd: "npm", args: ["run", "dev"], cwd: APP_DIR, detached: true });
    for (let i = 0; i < 20 && !(await up()); i++) await new Promise((r) => setTimeout(r, 500));
  }
  return { url: sb.domain(PORT), up: await up() };
}
