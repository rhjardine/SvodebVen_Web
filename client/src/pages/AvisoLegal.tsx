import { AVISO_LEGAL, TITULAR } from "@/content/legal";
import { Dato, LegalPage, LegalSection } from "@/features/legal/LegalPage";

/**
 * BORRADOR de Aviso legal. Debe ser revisado por la directiva y asesoría legal antes de su
 * aprobación definitiva. Los datos del titular provienen de `content/legal.ts` (sin inventar).
 */
export default function AvisoLegal() {
  return (
    <LegalPage
      title="Aviso legal"
      documento={AVISO_LEGAL}
      summary="Quién es el responsable de este sitio, cómo contactarlo y las reglas básicas para usarlo."
    >
      <LegalSection title="1. Titular del sitio">
        <p>
          Este sitio web es operado por la {TITULAR.denominacion} (
          {TITULAR.sigla}), en adelante «la Sociedad».
        </p>
        <ul>
          <Dato etiqueta="Denominación" valor={TITULAR.denominacion} />
          <Dato etiqueta="RIF" valor={TITULAR.rif} />
          <Dato etiqueta="Forma jurídica" valor={TITULAR.formaJuridica} />
          <Dato etiqueta="Domicilio" valor={TITULAR.domicilio} />
          <Dato etiqueta="Datos de registro" valor={TITULAR.datosRegistro} />
          <Dato
            etiqueta="Representante legal"
            valor={TITULAR.representanteLegal}
          />
          <Dato etiqueta="Correo de contacto" valor={TITULAR.email} />
          <Dato etiqueta="Sitio web" valor={TITULAR.dominio} />
        </ul>
      </LegalSection>

      <LegalSection title="2. Objeto del sitio">
        <p>
          El sitio informa sobre la Sociedad, sus actividades y su comunidad, y
          ofrece herramientas para solicitar la afiliación, consultar el
          directorio público de especialistas verificados y, para los miembros,
          acceder a su cuenta.
        </p>
      </LegalSection>

      <LegalSection title="3. Condiciones de uso">
        <p>
          Al navegar por el sitio aceptas usarlo de buena fe y conforme a la
          ley. En particular, te comprometes a:
        </p>
        <ul>
          <li>
            Dar información veraz en la planilla de afiliación y no suplantar la
            identidad de otra persona.
          </li>
          <li>
            No intentar acceder a áreas restringidas, a cuentas ajenas ni a
            datos que no te correspondan.
          </li>
          <li>
            No extraer de forma masiva o automatizada la información del
            directorio, ni usarla para enviar comunicaciones comerciales no
            solicitadas.
          </li>
          <li>
            No alterar, sobrecargar ni interferir con el funcionamiento del
            sitio.
          </li>
        </ul>
        <p>
          La Sociedad puede suspender el acceso de quien incumpla estas
          condiciones.
        </p>
      </LegalSection>

      <LegalSection title="4. Carácter informativo: no es atención clínica">
        <p>
          Los contenidos del sitio tienen fines institucionales e informativos.
          No constituyen diagnóstico, tratamiento ni consejo odontológico
          personalizado, y no sustituyen la consulta con un profesional de la
          salud. El directorio muestra datos de miembros verificados por la
          Sociedad, pero la relación profesional con cada especialista es ajena
          al sitio.
        </p>
      </LegalSection>

      <LegalSection title="5. Propiedad intelectual">
        <p>
          El nombre, el logotipo y los demás signos distintivos de la Sociedad,
          así como los textos, el diseño y el código del sitio, pertenecen a la
          Sociedad o se usan con autorización de sus titulares. No se permite su
          reproducción, distribución o uso con fines comerciales sin permiso
          previo y por escrito, salvo lo que la ley autorice. Las marcas y
          contenidos de terceros pertenecen a sus respectivos propietarios.
        </p>
      </LegalSection>

      <LegalSection title="6. Enlaces a sitios de terceros">
        <p>
          El sitio puede enlazar a páginas de terceros (por ejemplo, nuestra
          cuenta oficial de Instagram). La Sociedad no controla esos sitios ni
          responde por su contenido o sus políticas de privacidad.
        </p>
      </LegalSection>

      <LegalSection title="7. Responsabilidad">
        <p>
          La Sociedad procura que la información del sitio sea exacta y esté
          actualizada, y que el servicio funcione sin interrupciones, pero no
          garantiza la disponibilidad continua ni la ausencia de errores. En la
          medida permitida por la ley, no responde por daños derivados de
          interrupciones, fallos técnicos o del uso indebido del sitio por parte
          de terceros. Esto no limita aquello que la ley no permita limitar.
        </p>
      </LegalSection>

      <LegalSection title="8. Datos personales">
        <p>
          El tratamiento de los datos personales que recibimos se explica en el{" "}
          <a
            className="font-semibold text-royal-600 underline"
            href="/privacidad"
          >
            Aviso de privacidad
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="9. Modificaciones">
        <p>
          La Sociedad puede actualizar este aviso. La versión vigente es la
          publicada en esta página, con su fecha de actualización.
        </p>
      </LegalSection>

      <LegalSection title="10. Ley aplicable y jurisdicción">
        <p>
          Este aviso se rige por las leyes de la República Bolivariana de
          Venezuela. Para cualquier controversia, las partes se someterán a los
          tribunales competentes:{" "}
          {TITULAR.jurisdiccion ?? <em>por confirmar</em>}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
