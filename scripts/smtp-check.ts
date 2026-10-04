/**
 * Verifica credenciales SMTP sin enviar correos (handshake + autenticación).
 * Uso: pnpm smtp:check   (lee las variables SMTP_* del entorno o de .env)
 */
import nodemailer from "nodemailer";
import { describeConfigError, loadConfig } from "../server/config";

async function main(): Promise<void> {
  try {
    const config = loadConfig(process.env);
    if (!config.success) {
      console.error(`✘ ${describeConfigError(config.error)}`);
      process.exit(1);
    }
    const { smtp } = config.value;
    if (!smtp) {
      console.error(
        "✘ SMTP no configurado: define todas las variables SMTP_*, MAIL_FROM y SECRETARIA_EMAIL."
      );
      process.exit(1);
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
    });
    await transporter.verify();
    console.log(
      `✔ Conexión y autenticación SMTP correctas (${smtp.host}:${smtp.port}).`
    );
    console.log(`  Las solicitudes llegarán a: ${smtp.secretariaEmail}`);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    console.error(`✘ Falló la verificación SMTP: ${detalle}`);
    process.exit(1);
  }
}

void main();
