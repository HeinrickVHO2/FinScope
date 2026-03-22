import nodemailer from "nodemailer";

type TransportOverride = {
  port?: number;
  secure?: boolean;
};

function buildTransportOptions(override: TransportOverride = {}): nodemailer.TransportOptions {
  const port = override.port ?? Number(process.env.MAIL_PORT || 465);
  const secure = override.secure ?? (
    process.env.MAIL_SECURE
      ? process.env.MAIL_SECURE === "true"
      : port === 465
  );

  return {
    host: process.env.MAIL_HOST || "smtp.titan.email",
    port,
    secure,
    auth: process.env.MAIL_USER && process.env.MAIL_PASS
      ? {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        }
      : undefined,
    connectionTimeout: Number(process.env.MAIL_CONNECTION_TIMEOUT_MS || 10000),
    greetingTimeout: Number(process.env.MAIL_GREETING_TIMEOUT_MS || 10000),
    socketTimeout: Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 20000),
    tls: {
      rejectUnauthorized: process.env.MAIL_TLS_REJECT_UNAUTHORIZED === "true",
    },
    family: 4,
  } as nodemailer.TransportOptions;
}

function buildSmtpAttempts() {
  const attempts: Array<{ port: number; secure: boolean }> = [];
  const configuredPort = Number(process.env.MAIL_PORT || 465);
  const configuredSecure = process.env.MAIL_SECURE
    ? process.env.MAIL_SECURE === "true"
    : configuredPort === 465;

  const pushAttempt = (port: number, secure: boolean) => {
    if (!attempts.some((item) => item.port === port && item.secure === secure)) {
      attempts.push({ port, secure });
    }
  };

  pushAttempt(configuredPort, configuredSecure);
  pushAttempt(587, false);
  pushAttempt(465, true);

  return attempts;
}

function isRetryableSmtpError(error: unknown) {
  const code = String((error as any)?.code || "");
  const command = String((error as any)?.command || "");
  const message = error instanceof Error ? error.message : String(error || "");

  return (
    code === "ETIMEDOUT"
    || code === "ESOCKET"
    || code === "ECONNREFUSED"
    || command === "CONN"
    || /timeout/i.test(message)
  );
}

function normalizeRecipients(value: nodemailer.SendMailOptions["to"]) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function sendWithResend(options: nodemailer.SendMailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: normalizeRecipients(options.to),
      cc: normalizeRecipients(options.cc),
      bcc: normalizeRecipients(options.bcc),
      reply_to: options.replyTo,
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`Resend request failed with status ${response.status}: ${payload}`);
  }
}

async function sendWithSmtp(options: nodemailer.SendMailOptions) {
  let lastError: unknown = null;

  for (const attempt of buildSmtpAttempts()) {
    const transporter = nodemailer.createTransport(buildTransportOptions(attempt));
    try {
      await transporter.sendMail(options);
      transporter.close();
      return;
    } catch (error) {
      transporter.close();
      lastError = error;
      if (!isRetryableSmtpError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("SMTP delivery failed");
}

export function createTransporter(override: TransportOverride = {}) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn("[MAILER] MAIL_USER ou MAIL_PASS nao configurados.");
  }

  return nodemailer.createTransport(buildTransportOptions(override));
}

export async function sendMailWithFallback(options: nodemailer.SendMailOptions) {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase();
  const prefersResend = provider === "resend" || (!provider && Boolean(process.env.RESEND_API_KEY));

  if (prefersResend) {
    try {
      await sendWithResend(options);
      return;
    } catch (error) {
      if (provider === "resend") {
        throw error;
      }
      console.error("[MAILER] Resend fallback failed, trying SMTP:", error);
    }
  }

  await sendWithSmtp(options);
}
