import { createTransporter } from "./transporter";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendContactEmail({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}) {
  const transporter = createTransporter();
  const ownerEmail = process.env.CONTACT_RECIPIENT || process.env.MAIL_USER || "contato@finscope.com.br";
  const senderEmail = process.env.MAIL_FROM || process.env.MAIL_USER || ownerEmail;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; padding: 24px;">
      <h2 style="margin-bottom: 16px;">Nova mensagem de contato</h2>
      <p><strong>Nome:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p style="margin-top: 16px; white-space: pre-line;">${safeMessage}</p>
    </div>
  `;

  const text = [
    "Nova mensagem de contato",
    `Nome: ${name}`,
    `Email: ${email}`,
    "",
    message,
  ].join("\n");

  await transporter.sendMail({
    from: `"FinScope Site" <${senderEmail}>`,
    to: ownerEmail,
    replyTo: email,
    subject: `Contato do site - ${name}`,
    text,
    html,
  });
}
