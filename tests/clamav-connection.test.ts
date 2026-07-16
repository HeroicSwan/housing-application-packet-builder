import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { probeClamAv, scanForMalware } from "@/lib/security/malware";

const servers: net.Server[] = [];
const sockets = new Set<net.Socket>();

async function listen(handler: (socket: net.Socket) => void) {
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    handler(socket);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as net.AddressInfo).port;
}

function respondToStream(socket: net.Socket, result: (request: Buffer) => string) {
  const chunks: Buffer[] = [];
  socket.on("data", (chunk) => {
    chunks.push(chunk);
    const request = Buffer.concat(chunks);
    if (request.length >= 4 && request.subarray(-4).equals(Buffer.alloc(4))) socket.end(`${result(request)}\0`);
  });
}

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("ClamAV connection probe", () => {
  it("checks both clean content and the safe EICAR signature", async () => {
    let connections = 0;
    const port = await listen((socket) => {
      connections += 1;
      respondToStream(socket, (request) => request.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) ? "stream: Eicar-Signature FOUND" : "stream: OK");
    });

    await expect(probeClamAv({ host: "127.0.0.1", port, timeoutMs: 500 })).resolves.toEqual({ ok: true, code: "CLAMAV_PROBE_OK" });
    expect(connections).toBe(2);
  });

  it("finishes on the protocol terminator and destroys sockets that servers leave open", async () => {
    const closed: Promise<void>[] = [];
    const port = await listen((socket) => {
      closed.push(new Promise((resolve) => socket.once("close", resolve)));
      const chunks: Buffer[] = [];
      socket.on("data", (chunk) => {
        chunks.push(chunk);
        const request = Buffer.concat(chunks);
        if (request.length >= 4 && request.subarray(-4).equals(Buffer.alloc(4))) socket.write(request.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) ? "stream: Eicar-Signature FOUND\0" : "stream: OK\0");
      });
    });

    await expect(probeClamAv({ host: "127.0.0.1", port, timeoutMs: 500 })).resolves.toEqual({ ok: true, code: "CLAMAV_PROBE_OK" });
    await Promise.all(closed);
    expect(closed).toHaveLength(2);
  });

  it("reports when EICAR is not detected without exposing a scanner response", async () => {
    const port = await listen((socket) => respondToStream(socket, () => "stream: OK"));

    const result = await probeClamAv({ host: "127.0.0.1", port, timeoutMs: 500 });
    expect(result).toEqual({ ok: false, code: "CLAMAV_EICAR_NOT_DETECTED" });
    expect(Object.keys(result).sort()).toEqual(["code", "ok"]);
  });

  it("caps scanner responses and returns a fixed failure code", async () => {
    const port = await listen((socket) => socket.end(Buffer.alloc(64, 65)));

    await expect(probeClamAv({ host: "127.0.0.1", port, timeoutMs: 500, maxResponseBytes: 8 })).resolves.toEqual({ ok: false, code: "CLAMAV_RESPONSE_TOO_LARGE" });
  });

  it("times out with a fixed code and destroys the client socket", async () => {
    let clientClosed!: Promise<void>;
    const port = await listen((socket) => {
      clientClosed = new Promise((resolve) => socket.once("close", resolve));
      socket.resume();
    });

    await expect(probeClamAv({ host: "127.0.0.1", port, timeoutMs: 30 })).resolves.toEqual({ ok: false, code: "CLAMAV_TIMEOUT" });
    await clientClosed;
  });

  it("preserves upload rejection behavior with injected ClamAV configuration", async () => {
    const port = await listen((socket) => respondToStream(socket, () => "stream: Eicar-Signature FOUND"));

    await expect(scanForMalware(new TextEncoder().encode("synthetic upload"), { scanner: "clamav", clamAv: { host: "127.0.0.1", port, timeoutMs: 500 } })).rejects.toThrow("The uploaded file was rejected by malware scanning.");
  });
});
