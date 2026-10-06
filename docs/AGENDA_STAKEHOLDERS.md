# Agenda para stakeholders · Sitio SVODEB

Documento para conversar con la directiva y con quienes solicitaron el sitio. Cada punto dice **qué hay que decidir, quién debería decidirlo y qué bloquea si no se decide**. Lo técnico ya está construido y probado; lo que falta son, sobre todo, decisiones y datos de la sociedad.

## 1. Bloqueantes para publicar

| #   | Decisión / dato                                                                                                                                                                                                                                                                                       | Quién decide                            | Qué bloquea                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | **Dominio**: ¿cuál es el definitivo (`svodeb.org` u otro)? ¿Está registrado? ¿A nombre de quién y en qué registrador?                                                                                                                                                                                 | Directiva                               | Todo: URL pública, correo corporativo, cookies seguras (HTTPS), enlaces de acceso |
| 2   | **Correo principal de contacto**. El sitio usa hoy `secretaria@svodeb.org`; el membrete usa `svodeb@gmail.com`. Confirmar la dirección exacta (¿`svodeb.org`?) y que el buzón sea atendido                                                                                                            | Secretaría / directiva                  | Pie del sitio, correo de respaldo de las afiliaciones                             |
| 3   | **Correo de envío (SMTP)**. El acceso de miembros funciona por enlace al correo: si esos mensajes caen en spam, nadie puede entrar. Opciones: Google Workspace, Gmail con contraseña de aplicación (solo para pruebas; límites de envío), o un servicio transaccional (Brevo, Postmark, Resend, etc.) | Directiva + quien administre el dominio | Afiliaciones, acuse, acceso de miembros                                           |
| 4   | **Hosting**. Propuesta actual: Render (servicio web + PostgreSQL de pago) con Cloudflare delante (DNS, caché, protección) y Cloudflare R2 para archivos en el sprint 5. Definir quién paga, con qué tarjeta y bajo qué cuenta                                                                         | Directiva / tesorería                   | Publicación y base de datos persistente                                           |
| 5   | **Titularidad de las cuentas**: dominio, hosting, Cloudflare, repositorio de GitHub y correo deben quedar a nombre de la sociedad (correos institucionales, no personales) y con **al menos dos administradores**                                                                                     | Directiva                               | Continuidad: hoy dependería de una sola persona                                   |
| 6   | **Aviso de privacidad y consentimiento**: revisión por asesoría legal (hoy es un borrador). Qué datos se guardan, por cuánto tiempo, y cómo se atiende un pedido de eliminación                                                                                                                       | Directiva + asesor legal                | Publicar el formulario de afiliación y el directorio                              |
| 7   | **RIF** (J-296571635) y nombre legal: confirmar con el acta constitutiva                                                                                                                                                                                                                              | Secretaría                              | Pie y avisos                                                                      |

## 2. Contenido pendiente (hoy el sitio lo muestra como "en actualización")

- Archivo maestro del **logotipo** (vector o PNG con fondo transparente) y, si existe, manual de marca.
- **ALODYB**: nombre completo y enlace oficial.
- **Categorías de membresía** y requisitos según los Estatutos (¿Activo, Asociado, Estudiante? ¿se exige número de colegiatura o MPPS?).
- **Junta Directiva** vigente (nombres, cargos, período) y **hitos históricos**.
- **Asamblea 2026**: fecha, sede y próximos eventos confirmados.
- Teléfono y redes oficiales que deban aparecer (el membrete trae `+58 416-6082849` e Instagram `@svodeb`).

## 3. Reglas de operación que alguien debe definir

- **Afiliaciones**: quién revisa, en cuánto tiempo responde y con qué criterios aprueba o rechaza.
- **Directorio de especialistas**: criterio de verificación, **vigencia** (¿un año?), cada cuánto se renueva y cómo se atienden reclamos o suplantaciones. Solo aparecen miembros con consentimiento expreso; no se publican correo ni teléfono.
- **Roles de personal**: quiénes serán administración, secretaría y tesorería, y cómo se dan de baja cuando alguien deja el cargo.
- **Soporte**: quién responde a un miembro que no puede entrar o que quiere borrar su ficha.

## 4. Decisiones que condicionan los próximos sprints

- **Eventos (sprint 5)**: ¿habrá cupos y reservas? ¿Quién crea los eventos? ¿Qué materiales se compartirán con miembros (PDF) y quién tiene los derechos para distribuirlos?
- **Pagos (sprint 6)**: métodos aceptados (Pago Móvil, transferencia, Zelle, efectivo…), formato real de cada referencia, **fuente de la tasa BCV**, quién concilia y qué documento se emite. Los aspectos contables y fiscales los debe confirmar un contador; no se asumen en el sistema.

## 5. Operación continua

- **Presupuesto mensual** y responsable de pagarlo (hosting, base de datos, dominio, correo).
- **Copias de seguridad**: el proveedor las ofrece según el plan; definir plazo de conservación.
- **Monitoreo**: alguien que reciba el aviso si el sitio se cae (hay una prueba de humo lista: `pnpm smoke <url>`).
- **Lanzamiento**: propuesta de salida gradual con un grupo piloto de miembros antes de anunciarlo a toda la sociedad.
- **Analítica**: hoy el sitio no usa cookies de seguimiento ni analítica. Si se quiere medir visitas, hay que decidir cuál y reflejarlo en el aviso de privacidad.

## 6. Qué ya está listo (para mostrar)

Sitio institucional con logo oficial · afiliación en línea con recepción segura · acceso de miembros por enlace al correo · panel de secretaría para revisar solicitudes · directorio público de especialistas con verificación y consentimiento · pruebas automáticas, revisión de seguridad y guía de despliegue (`docs/DESPLIEGUE.md`).
