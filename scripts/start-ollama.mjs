import { spawn } from "node:child_process";

const model = "qwen2.5vl:7b";
const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const command = process.platform === "win32" ? "ollama.exe" : "ollama";

async function healthy() {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(2500) });
    return response.ok;
  } catch { return false; }
}

if (!(await healthy())) {
  const child = spawn(command, ["serve"], { detached: true, windowsHide: true, stdio: "ignore" });
  child.unref();
  for (let attempt = 0; attempt < 20 && !(await healthy()); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!(await healthy())) throw new Error(`Ollama did not become ready at ${baseUrl}. Start Ollama and retry.`);
console.log(`[ai:start] Ollama is ready at ${baseUrl}. Required model: ${model}.`);
