/** Solicitud válida con entradas "sucias" para probar la normalización. */
export const solicitudValida = Object.freeze({
  categoria: "ASOCIADO",
  nombres: "María",
  apellidos: "Pérez",
  email: "  Maria.Perez@Correo.com ",
  telefono: "0414-123.45 67",
  entidad: "Miranda",
  ciudad: "Los Teques",
  universidad: "Universidad Central de Venezuela",
  anioEgreso: "2015",
  numeroColegiatura: "",
  areas: ["ESTETICA", "BIOMATERIALES", "ESTETICA"],
  motivacion: "Quiero actualizarme en resinas compuestas.",
  consentimiento: true,
});
