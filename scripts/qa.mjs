import { spawn, spawnSync } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticOnly = process.argv.includes("--static-only");
const failures = [];

await checkRequiredFiles();
await checkJavaScriptSyntax();
await checkHtmlAssets();
await checkRepositorySafety();
await checkRules();
if (!staticOnly) await checkLocalPage();

if (failures.length) {
  console.error("\nQA failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`QA passed: static checks${staticOnly ? "" : " and local page smoke test"}.`);

async function checkRequiredFiles() {
  const required = ["index.html", "styles.css", "src/app.js", "src/config.js", "firestore.rules", "storage.rules", ".nojekyll", "privacy.html", "terms.html"];
  for (const path of required) if (!(await exists(join(root, path)))) failures.push(`Required file is missing: ${path}`);
}

async function checkJavaScriptSyntax() {
  const files = (await walk(root)).filter((path) => [".js", ".mjs"].includes(extname(path)));
  for (const path of files) {
    const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    if (result.status !== 0) failures.push(`JavaScript syntax error: ${relative(root, path)}\n${result.stderr}`);
  }
}

async function checkHtmlAssets() {
  for (const htmlFile of ["index.html", "privacy.html", "terms.html"]) {
    const html = await readFile(join(root, htmlFile), "utf8");
    const references = [...html.matchAll(/(?:href|src)="\.\/([^"?#]+)["?#]?/g)].map((match) => match[1]).filter((path) => path && path !== "");
    for (const reference of references) if (!(await exists(join(root, reference)))) failures.push(`${htmlFile} references a missing file: ${reference}`);
  }
  const index = await readFile(join(root, "index.html"), "utf8");
  for (const id of ["login-view", "workspace", "main-nav", "page-content", "toast-root"]) if (!index.includes(`id="${id}"`)) failures.push(`Required application surface is missing: #${id}`);
}

async function checkRepositorySafety() {
  const workflowPath = join(root, ".github", "workflows");
  if (await exists(workflowPath)) {
    const workflows = (await walk(workflowPath)).filter((path) => [".yml", ".yaml"].includes(extname(path)));
    if (workflows.length) failures.push("GitHub Actions workflow found; Pages must deploy from main/(root). ");
  }

  const forbiddenExtensions = new Set([".csv", ".xlsx", ".xls", ".pdf", ".zip"]);
  const files = await walk(root);
  for (const path of files) if (forbiddenExtensions.has(extname(path).toLowerCase())) failures.push(`Private-data file type found: ${relative(root, path)}`);

  const privatePatterns = [
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /client[_-]?secret\s*[:=]\s*["'][^"']+/i,
    /service[_-]?account\s*[:=]/i,
    /password\s*[:=]\s*["'][^"']+/i
  ];
  const textExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".md", ".rules", ".yml", ".yaml"]);
  for (const path of files.filter((item) => textExtensions.has(extname(item)))) {
    if (path.endsWith("scripts\\qa.mjs") || path.endsWith("scripts/qa.mjs")) continue;
    const repositoryPath = relative(root, path).replaceAll("\\", "/");
    let content = await readFile(path, "utf8");
    if (repositoryPath === "src/config.js") {
      content = content.replace(/(apiKey\\s*:\\s*["'])AIza[0-9A-Za-z_-]{20,}(["'])/, "$1<Firebase web API key>$2");
    }
    if (privatePatterns.some((pattern) => pattern.test(content))) failures.push(`Possible credential found: ${relative(root, path)}`);
  }
}

async function checkRules() {
  const rules = await readFile(join(root, "firestore.rules"), "utf8");
  for (const rule of ["match /studentPrivate/{studentId}", "match /assessmentResults/{resultId}", "match /consultations/{consultationId}", "allow read, write: if false"]) {
    if (!rules.includes(rule)) failures.push(`Firestore security rule is missing: ${rule}`);
  }
}

async function checkLocalPage() {
  const port = await reservePort();
  const server = spawn(process.execPath, [join(root, "scripts", "serve.mjs")], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const rootResponse = await waitForResponse(`${baseUrl}/?demo=admin`);
    const cssResponse = await fetch(`${baseUrl}/styles.css`);
    const appResponse = await fetch(`${baseUrl}/src/app.js`);
    if (rootResponse.status !== 200) failures.push(`Local page returned HTTP ${rootResponse.status}.`);
    if (cssResponse.status !== 200) failures.push(`Local stylesheet returned HTTP ${cssResponse.status}.`);
    if (appResponse.status !== 200) failures.push(`Local application script returned HTTP ${appResponse.status}.`);
    if (!(await rootResponse.text()).includes("Academy Operations Hub")) failures.push("Local page is missing the application title.");
  } finally {
    server.kill();
  }
}

async function waitForResponse(url) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { return await fetch(url); } catch (error) { lastError = error; await new Promise((resolveDelay) => setTimeout(resolveDelay, 100)); }
  }
  throw lastError;
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolveListen, rejectListen) => { server.once("error", rejectListen); server.listen(0, "127.0.0.1", resolveListen); });
  const { port } = server.address();
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}
