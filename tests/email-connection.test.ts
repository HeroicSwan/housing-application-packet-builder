import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTransport } = vi.hoisted(() => ({ createTransport: vi.fn() }));

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("@/lib/env", () => ({ env: { SMTP_HOST: "smtp.runtime", SMTP_PORT: 587, SMTP_SECURE: false, SMTP_USER: undefined, SMTP_PASSWORD: undefined, EMAIL_FROM: "sender@example.test" } }));

import { createSmtpTransport, sendEmail, verifySmtpConnection } from "@/lib/email";

describe("SMTP connection helpers", () => {
  beforeEach(() => {
    createTransport.mockReset();
  });

  it("creates a transport with injected credentials and bounded network timeouts", () => {
    const transport = { verify: vi.fn(), close: vi.fn() };
    createTransport.mockReturnValue(transport);

    expect(createSmtpTransport({ host: "smtp.internal", port: 465, secure: true, user: "relay", password: "secret" }, 2_500)).toBe(transport);
    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.internal",
      port: 465,
      secure: true,
      auth: { user: "relay", pass: "secret" },
      connectionTimeout: 2_500,
      greetingTimeout: 2_500,
      socketTimeout: 2_500,
      dnsTimeout: 2_500,
    });
  });

  it("closes the transport after successful verification", async () => {
    const transport = { verify: vi.fn().mockResolvedValue(true), close: vi.fn() };
    createTransport.mockReturnValue(transport);

    await expect(verifySmtpConnection({ host: "smtp.internal", port: 587, secure: false }, 500)).resolves.toEqual({ ok: true, code: "SMTP_CONNECTION_OK" });
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("returns only an allowlisted failure code and closes after provider errors", async () => {
    const transport = { verify: vi.fn().mockRejectedValue(new Error("535 password=do-not-expose")), close: vi.fn() };
    createTransport.mockReturnValue(transport);

    const result = await verifySmtpConnection({ host: "smtp.internal", port: 587, secure: false, user: "relay", password: "do-not-expose" }, 500);
    expect(result).toEqual({ ok: false, code: "SMTP_CONNECTION_FAILED" });
    expect(JSON.stringify(result)).not.toContain("do-not-expose");
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("bounds verification even when the transport never settles", async () => {
    const transport = { verify: vi.fn().mockReturnValue(new Promise(() => undefined)), close: vi.fn() };
    createTransport.mockReturnValue(transport);

    await expect(verifySmtpConnection({ host: "smtp.internal", port: 587, secure: false }, 10)).resolves.toEqual({ ok: false, code: "SMTP_CONNECTION_FAILED" });
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("preserves delivery results and closes the runtime transport", async () => {
    const transport = { sendMail: vi.fn().mockResolvedValue({ messageId: "message-123" }), close: vi.fn() };
    createTransport.mockReturnValue(transport);

    await expect(sendEmail({ to: "recipient@example.test", subject: "Synthetic test", text: "No applicant data." })).resolves.toBe("message-123");
    expect(transport.sendMail).toHaveBeenCalledWith({ from: "sender@example.test", to: "recipient@example.test", subject: "Synthetic test", text: "No applicant data." });
    expect(transport.close).toHaveBeenCalledOnce();
  });

  it("preserves delivery failures while still closing the runtime transport", async () => {
    const failure = new Error("delivery failed");
    const transport = { sendMail: vi.fn().mockRejectedValue(failure), close: vi.fn() };
    createTransport.mockReturnValue(transport);

    await expect(sendEmail({ to: "recipient@example.test", subject: "Synthetic test", text: "No applicant data." })).rejects.toBe(failure);
    expect(transport.close).toHaveBeenCalledOnce();
  });
});
