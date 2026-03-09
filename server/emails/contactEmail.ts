import { createTransporter } from "./transporter";

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

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; padding: 24px;">
      <h2 style="margin-bottom: 16px;">Nova mensagem de contato</h2>
      <p><strong>Nome:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p style="margin-top: 16px; white-space: pre-line;">${message}</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"FinScope Site" <${process.env.MAIL_USER}>`,
    to: ownerEmail,
    replyTo: email,
    subject: `Contato do site - ${name}`,
    html,
  });
}
