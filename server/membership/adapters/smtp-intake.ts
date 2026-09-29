import nodemailer, { type Transporter } from "nodemailer";
import {
  AREA_LABEL,
  CATEGORIA_LABEL,
} from "../../../shared/membership/catalog";
import type {
  ApplicationIntake,
  Logger,
  MembershipApplication,
} from "../submit-application";

export type SmtpIntakeConfig = Readonly<{
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  secretariaEmail: string;
}>;

const formatter = new Intl.DateTimeFormat("es-VE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Caracas",
});

/** Cuerpo en texto plano: sin HTML, sin riesgo de inyección de marcado. */
export function renderSecretariaEmail(
  application: MembershipApplication
): string {
  const { datos } = application;
  const lines: string[] = [
    `Referencia: ${application.referencia}`,
    `Recibida: ${formatter.format(application.recibidaEn)} (hora de Caracas)`,
    "",
    `Categoría solicitada: ${CATEGORIA_LABEL[datos.categoria]}`,
    `Nombre: ${datos.nombres} ${datos.apellidos}`,
    `Correo: ${datos.email}`,
    `Teléfono: ${datos.telefono}`,
    `Ubicación: ${datos.ciudad}, ${datos.entidad}`,
    `Universidad: ${datos.universidad}`,
  ];

  if (datos.categoria === "ESTUDIANTE") {
    lines.push(`Semestre: ${datos.semestre}`);
  } else {
    lines.push(`Año de egreso: ${datos.anioEgreso}`);
    lines.push(
      `N.º de colegiatura: ${datos.numeroColegiatura ?? "No indicado"}`
    );
  }

  lines.push(
    `Áreas de interés: ${datos.areas.map(area => AREA_LABEL[area]).join(", ")}`
  );
  lines.push("", "Motivación:", datos.motivacion ?? "(sin comentarios)");
  lines.push(
    "",
    "El postulante autorizó el tratamiento de sus datos para este proceso."
  );
  return lines.join("\n");
}

export function renderAcuseEmail(application: MembershipApplication): string {
  return [
    `Hola, ${application.datos.nombres}:`,
    "",
    "Recibimos tu solicitud de afiliación a la Sociedad Venezolana de Operatoria Dental, Estética y Biomateriales (SVODEB).",
    "",
    `Tu número de referencia es ${application.referencia}. Consérvalo para cualquier consulta.`,
    "",
    "La secretaría revisará tu información y te contactará para los siguientes pasos.",
    "",
    "Si no realizaste esta solicitud, puedes ignorar este mensaje.",
    "",
    "SVODEB",
  ].join("\n");
}

export class SmtpApplicationIntake implements ApplicationIntake {
  readonly isConfigured = true;
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

  async deliver(application: MembershipApplication): Promise<void> {
    // 1) Notificación a secretaría: si falla, la solicitud NO se considera recibida.
    await this.transporter.sendMail({
      from: this.config.from,
      to: this.config.secretariaEmail,
      replyTo: application.datos.email,
      subject: `Solicitud de afiliación ${application.referencia} · ${CATEGORIA_LABEL[application.datos.categoria]}`,
      text: renderSecretariaEmail(application),
    });

    // 2) Acuse al postulante: mejor esfuerzo; un fallo aquí no invalida la recepción.
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: application.datos.email,
        subject: `Recibimos tu solicitud · ${application.referencia}`,
        text: renderAcuseEmail(application),
      });
    } catch (cause) {
      this.logger.error("membership.ack_failed", {
        referencia: application.referencia,
        reason: cause instanceof Error ? cause.message : "unknown",
      });
    }
  }
}

/** Adaptador explícito cuando no hay canal configurado: la API responde 503 con honestidad. */
export const unconfiguredIntake: ApplicationIntake = Object.freeze({
  isConfigured: false,
  deliver: async () => {
    throw new Error("Intake not configured");
  },
});
