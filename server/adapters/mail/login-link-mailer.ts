import nodemailer, { type Transporter } from "nodemailer";
import {
  describeCause,
  ok,
  tryAsync,
  type Result,
} from "../../../shared/result";
import type { SmtpIntakeConfig } from "../../membership/adapters/smtp-intake";
import type { Logger } from "../../membership/submit-application";

export type LoginLinkMail = Readonly<{
  to: string;
  nombres: string;
  /** Enlace completo; el token va en el fragmento (#token=…) y no llega a logs ni a Referer. */
  url: string;
  expiresInMinutes: number;
}>;

export type LoginLinkMailer = Readonly<{
  send: (mail: LoginLinkMail) => Promise<Result<void, string>>;
}>;

export function renderLoginLinkEmail(mail: LoginLinkMail): string {
  return [
    `Hola, ${mail.nombres}:`,
    "",
    "Usa este enlace para ingresar a tu cuenta de SVODEB:",
    mail.url,
    "",
    `Caduca en ${mail.expiresInMinutes} minutos y solo funciona una vez.`,
    "Si no lo solicitaste, ignora este mensaje: nadie puede entrar sin él.",
    "",
    "SVODEB",
  ].join("\n");
}

export class SmtpLoginLinkMailer implements LoginLinkMailer {
  private readonly transporter: Transporter;

  constructor(
    private readonly config: SmtpIntakeConfig,
    private readonly logger: Logger
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
  }

  async send(mail: LoginLinkMail): Promise<Result<void, string>> {
    const sent = await tryAsync(
      () =>
        this.transporter.sendMail({
          from: this.config.from,
          to: mail.to,
          subject: "Tu enlace de acceso a SVODEB",
          text: renderLoginLinkEmail(mail),
        }),
      describeCause
    );
    if (!sent.success) {
      this.logger.error("auth.login_link_mail_failed", { reason: sent.error });
      return sent;
    }
    return ok(undefined);
  }
}

/** SOLO desarrollo: imprime el enlace en consola. Nunca se usa en producción (ver composición). */
export class ConsoleLoginLinkMailer implements LoginLinkMailer {
  send(mail: LoginLinkMail): Promise<Result<void, string>> {
    console.log(`[dev] Enlace de acceso para ${mail.to}: ${mail.url}`);
    return Promise.resolve(ok(undefined));
  }
}

/** Sin canal de correo configurado: falla visible en el log, respuesta pública uniforme. */
export const unconfiguredLoginLinkMailer: LoginLinkMailer = Object.freeze({
  send: () =>
    Promise.resolve({ success: false as const, error: "MAIL_NOT_CONFIGURED" }),
});
