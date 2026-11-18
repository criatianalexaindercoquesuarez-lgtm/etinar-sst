import type { Discipline, Frequency } from './internal.entities';

/**
 * Catálogo base de obligaciones del personal interno por obra.
 * SST: tomado del documento "GESTIÓN SST 2026" de ETINAR (30 carpetas, con su
 * frecuencia de inspección y documentación requerida).
 * Ambiente, Médico y Social: propuesta inicial. Todo es editable desde el panel (Documentación Interna →
 * Configuración → Actividades). Las palabras clave sirven para reconocer
 * automáticamente la evidencia dentro de las carpetas de OneDrive.
 */
export const ACTIVITY_SEED: {
  code: string;
  name: string;
  discipline: Discipline;
  frequency: Frequency;
  graceDays: number;
  minEvidence: number;
  keywords: string;
  defaultFolder: string;
  description?: string;
}[] = [
  // ---------------- SST — "GESTIÓN SST 2026" de ETINAR (30 carpetas) ----------------
  { code: 'SST-01', name: 'CRONOGRAMA DE CAPACITACIONES', discipline: 'sst', frequency: 'anual', graceDays: 15, minEvidence: 1, keywords: 'cronograma+capacitacion,matriz de capacitacion', defaultFolder: 'CRONOGRAMA DE CAPACITACIONES', description: 'Documentación requerida: Matriz de capacitaciones' },
  { code: 'SST-02', name: 'PLAN DE CONTINGENCIA', discipline: 'sst', frequency: 'anual', graceDays: 15, minEvidence: 1, keywords: 'plan de contingencia,contingencia', defaultFolder: 'PLAN DE CONTINGENCIA', description: 'Documentación requerida: Informe' },
  { code: 'SST-03', name: 'MATRIZ DE RIESGO', discipline: 'sst', frequency: 'semestral', graceDays: 15, minEvidence: 1, keywords: 'matriz de riesgo,matriz iper,iper', defaultFolder: 'MATRIZ DE RIESGO', description: 'Documentación requerida: Elaboración de matriz' },
  { code: 'SST-04', name: 'SIMULACROS', discipline: 'sst', frequency: 'semestral', graceDays: 15, minEvidence: 1, keywords: 'simulacro', defaultFolder: 'SIMULACROS', description: 'Documentación requerida: Informe y evidencias fotográficas' },
  { code: 'SST-05', name: 'BRIGADAS DE EMERGENCIA', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'brigada', defaultFolder: 'BRIGADAS DE EMERGENCIA', description: 'Documentación requerida: Acta de conformación y evidencia fotográfica' },
  { code: 'SST-06', name: 'BUZÓN DE SUGERENCIA', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'buzon', defaultFolder: 'BUZÓN DE SUGERENCIA', description: 'Documentación requerida: Formato de inspección y evidencia fotográfica' },
  { code: 'SST-07', name: 'CAPACITACIONES (PMA ambientales, entrenamientos, charlas, inducción de inicio de trabajos, reinducciones)', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'capacitacion+-cronograma+-certificado+-matriz,charla,entrenamiento,induccion,pma', defaultFolder: 'CAPACITACIONES', description: 'Documentación requerida: Formato de capacitaciones y entrenamientos' },
  { code: 'SST-08', name: 'CONTROL DE DESECHOS (peligroso, no peligroso, bitácoras)', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'desecho,bitacora', defaultFolder: 'CONTROL DE DESECHOS', description: 'Documentación requerida: Formato de inspección y registro fotográfico' },
  { code: 'SST-09', name: 'INSPECCIÓN DE HERRAMIENTAS ELÉCTRICAS O MANUALES', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'herramienta', defaultFolder: 'INSPECCIÓN DE HERRAMIENTAS ELÉCTRICAS O MANUALES', description: 'Documentación requerida: Formato de inspección y registro fotográfico' },
  { code: 'SST-10', name: 'INSPECCIÓN DE MAQUINARIAS', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'maquinaria', defaultFolder: 'INSPECCIÓN DE MAQUINARIAS', description: 'Documentación requerida: Formato de inspección, registro fotográfico, certificados o licencia del operador' },
  { code: 'SST-11', name: 'SUB-CONTRATISTAS (actas de capacitación, certificados de prevención, nómina de afiliación, permisos de trabajo)', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'sub-contratista,subcontratista,sub contratista', defaultFolder: 'SUB-CONTRATISTAS', description: 'Documentación requerida: Formatos de registros y evidencias fotográficas' },
  { code: 'SST-12', name: 'REGLAMENTO INTERNO Y POLÍTICAS DE LA EMPRESA (seguridad, calidad)', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'reglamento,politica', defaultFolder: 'REGLAMENTO INTERNO Y POLÍTICAS DE LA EMPRESA', description: 'Documentación requerida: Formato de inspección y evidencia fotográfica' },
  { code: 'SST-13', name: 'ENTREGA DE EPP (grupal, individual, inventario, reposición)', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'epp+-contratista', defaultFolder: 'ENTREGA DE EPP', description: 'Documentación requerida: Registro de entrega de EPP, formato de inspección y evidencia fotográfica' },
  { code: 'SST-14', name: 'MITIGACIÓN O CONTROL DE POLVO', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'polvo', defaultFolder: 'MITIGACIÓN O CONTROL DE POLVO', description: 'Documentación requerida: Informe de inspección y evidencia fotográfica' },
  { code: 'SST-15', name: 'INFORME DE SEÑALÉTICA Y DELIMITACIÓN DE ÁREA', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'senaletica,delimitacion,senalizacion', defaultFolder: 'INFORME DE SEÑALÉTICA Y DELIMITACIÓN DE ÁREA', description: 'Documentación requerida: Informe de inspección y evidencia fotográfica' },
  { code: 'SST-16', name: 'INFORME DE EXTINTOR', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'extintor', defaultFolder: 'INFORME DE EXTINTOR', description: 'Documentación requerida: Formato de inspección y evidencia fotográfica' },
  { code: 'SST-17', name: 'INSPECCIÓN DE GRÚA', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'grua', defaultFolder: 'INSPECCIÓN DE GRÚA', description: 'Documentación requerida: Formato de inspección y evidencia fotográfica' },
  { code: 'SST-18', name: 'INSPECCIÓN DE ANDAMIOS', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'andamio', defaultFolder: 'INSPECCIÓN DE ANDAMIOS', description: 'Documentación requerida: Formato de inspección y evidencia fotográfica' },
  { code: 'SST-19', name: 'FICHAS DE SEGURIDAD MSDS', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'msds,fichas de seguridad,ficha de seguridad,hoja de seguridad', defaultFolder: 'FICHAS DE SEGURIDAD MSDS', description: 'Documentación requerida: Ficha de seguridad y evidencia fotográfica' },
  { code: 'SST-20', name: 'LLAMADOS DE ATENCIÓN Y MULTAS', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'llamado de atencion,llamados de atencion,multa,sancion', defaultFolder: 'LLAMADOS DE ATENCIÓN Y MULTAS', description: 'Documentación requerida: Informe de llamado de atención o sanciones' },
  { code: 'SST-21', name: 'MAPAS DE RIESGOS', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'mapa de riesgo,mapas de riesgo', defaultFolder: 'MAPAS DE RIESGOS', description: 'Documentación requerida: Formato de inspección y evidencia fotográfica' },
  { code: 'SST-22', name: 'CERTIFICADO DE APTITUD', discipline: 'sst', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'aptitud,actitud', defaultFolder: 'CERTIFICADO DE APTITUD', description: 'Documentación requerida: Documento escaneado y firmado' },
  { code: 'SST-23', name: 'ART (Análisis de Riesgo de la Tarea)', discipline: 'sst', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'art,analisis de riesgo', defaultFolder: 'ART', description: 'Documentación requerida: Formato de inspección' },
  { code: 'SST-24', name: 'PERMISO DE TRABAJOS', discipline: 'sst', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'permiso+-contratista', defaultFolder: 'PERMISO DE TRABAJOS', description: 'Documentación requerida: Formato de inspección' },
  { code: 'SST-25', name: 'INSPECCIÓN DE BAÑOS O BATERÍAS SANITARIAS', discipline: 'sst', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'banos,bateria sanitaria,baterias sanitarias', defaultFolder: 'INSPECCIÓN DE BAÑOS O BATERÍAS SANITARIAS', description: 'Documentación requerida: Formato de inspección y registro fotográfico' },
  { code: 'SST-26', name: 'CARTELERA SST', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'cartelera', defaultFolder: 'CARTELERA SST', description: 'Documentación requerida: Registro fotográfico' },
  { code: 'SST-27', name: 'EVIDENCIA DE CAPACITACIONES DE CERTIFICADOS', discipline: 'sst', frequency: 'trimestral', graceDays: 10, minEvidence: 1, keywords: 'certificado+capacitacion+-contratista', defaultFolder: 'EVIDENCIA DE CAPACITACIONES DE CERTIFICADOS', description: 'Documentación requerida: Registro fotográfico' },
  { code: 'SST-28', name: 'INFORME DE ILUMINACIÓN DE OBRA', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'iluminacion', defaultFolder: 'INFORME DE ILUMINACIÓN DE OBRA', description: 'Documentación requerida: Informe de inspección y evidencia fotográfica' },
  { code: 'SST-29', name: 'IMPLEMENTOS CONTRA EMERGENCIAS', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'implementos+emergencia,contra emergencia', defaultFolder: 'IMPLEMENTOS CONTRA EMERGENCIAS', description: 'Documentación requerida: Informe de inspección y evidencia fotográfica' },
  { code: 'SST-30', name: 'ALMACENAMIENTO DE SUSTANCIAS PELIGROSAS', discipline: 'sst', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'sustancias peligrosas,sustancia peligrosa,almacenamiento+quimico', defaultFolder: 'ALMACENAMIENTO DE SUSTANCIAS PELIGROSAS', description: 'Documentación requerida: Informe de inspección y evidencia fotográfica' },
  // ---------------- Ambiente ----------------
  { code: 'AMB-01', name: 'Registro de generación y gestión de residuos', discipline: 'ambiente', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'residuo,desecho,bitacora,bitácora', defaultFolder: 'Ambiente/Residuos' },
  { code: 'AMB-02', name: 'Inspección ambiental semanal', discipline: 'ambiente', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'inspeccion ambiental,inspección ambiental,inspeccion', defaultFolder: 'Ambiente/Inspecciones' },
  { code: 'AMB-03', name: 'Manifiestos / actas de entrega a gestor ambiental', discipline: 'ambiente', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'manifiesto,gestor,cadena de custodia', defaultFolder: 'Ambiente/Gestores' },
  { code: 'AMB-04', name: 'Control de consumo de agua, energía y combustible', discipline: 'ambiente', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'consumo,agua,combustible,energia,energía', defaultFolder: 'Ambiente/Consumos' },
  { code: 'AMB-05', name: 'Charla / capacitación ambiental', discipline: 'ambiente', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'charla ambiental,capacitacion ambiental,capacitación', defaultFolder: 'Ambiente/Capacitaciones' },
  { code: 'AMB-06', name: 'Informe mensual ambiental (cumplimiento PMA)', discipline: 'ambiente', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'informe mensual,pma,plan de manejo', defaultFolder: 'Ambiente/Informes mensuales' },
  { code: 'AMB-07', name: 'Monitoreo de ruido, polvo y emisiones', discipline: 'ambiente', frequency: 'trimestral', graceDays: 10, minEvidence: 1, keywords: 'monitoreo,ruido,polvo,emision,emisión', defaultFolder: 'Ambiente/Monitoreos' },
  // ---------------- Médico ----------------
  { code: 'MED-01', name: 'Registro de atenciones médicas y morbilidad', discipline: 'medico', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'atencion,atención,morbilidad,consulta', defaultFolder: 'Médico/Atenciones' },
  { code: 'MED-02', name: 'Seguimiento de exámenes ocupacionales (ingreso, periódicos, retiro)', discipline: 'medico', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'examen,examenes,exámenes,ocupacional,aptitud', defaultFolder: 'Médico/Exámenes ocupacionales' },
  { code: 'MED-03', name: 'Inspección de botiquines y stock de medicamentos', discipline: 'medico', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'botiquin,botiquín,medicamento,stock', defaultFolder: 'Médico/Botiquines' },
  { code: 'MED-04', name: 'Charla de promoción de la salud', discipline: 'medico', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'charla,promocion,promoción,salud', defaultFolder: 'Médico/Charlas' },
  { code: 'MED-05', name: 'Vigilancia de la salud y seguimiento de casos', discipline: 'medico', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'vigilancia,seguimiento,caso', defaultFolder: 'Médico/Vigilancia de la salud' },
  { code: 'MED-06', name: 'Informe mensual médico con indicadores', discipline: 'medico', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'informe mensual,indicadores', defaultFolder: 'Médico/Informes mensuales' },
  { code: 'MED-07', name: 'Programa de riesgo psicosocial (actividades del período)', discipline: 'medico', frequency: 'trimestral', graceDays: 10, minEvidence: 1, keywords: 'psicosocial', defaultFolder: 'Médico/Programas' },
  { code: 'MED-08', name: 'Programa de prevención de alcohol, tabaco y drogas', discipline: 'medico', frequency: 'trimestral', graceDays: 10, minEvidence: 1, keywords: 'alcohol,drogas,tabaco', defaultFolder: 'Médico/Programas' },
  { code: 'MED-09', name: 'Informe trimestral de indicadores de salud (enfermedad común, profesional, accidentes)', discipline: 'medico', frequency: 'trimestral', graceDays: 10, minEvidence: 1, keywords: 'trimestral,indicadores', defaultFolder: 'Médico/Informes trimestrales' },
  // ---------------- Social ----------------
  { code: 'SOC-01', name: 'Registro de relacionamiento comunitario, quejas y reclamos', discipline: 'social', frequency: 'semanal', graceDays: 1, minEvidence: 1, keywords: 'comunidad,queja,reclamo,relacionamiento', defaultFolder: 'Social/Registros' },
  { code: 'SOC-02', name: 'Socialización con la comunidad (acta y fotos)', discipline: 'social', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'socializacion,socialización,acta', defaultFolder: 'Social/Socializaciones' },
  { code: 'SOC-03', name: 'Informe mensual de gestión social', discipline: 'social', frequency: 'mensual', graceDays: 5, minEvidence: 1, keywords: 'informe mensual,gestion social,gestión social', defaultFolder: 'Social/Informes mensuales' },
];

/**
 * Requisitos del Anexo 1 (Lista de verificación SST) del Acuerdo Ministerial
 * MDT-2024-196. Texto resumido; las referencias legales son las del Anexo 1.
 * La vigencia (días) es un valor de control interno sugerido y editable:
 * define cuándo el sistema alerta que la evidencia debe actualizarse.
 */
type Req = [code: string, description: string, legalRef: string, validityDays: number | null, evidenceType: 'documental' | 'in_situ', discipline: Discipline, keywords: string];

const GA = 'Gestión Administrativa';
const GT = 'Gestión Técnica';
const TH = 'Gestión del Talento Humano';
const PO = 'Procedimientos Operativos Básicos';
const SP = 'Servicios Permanentes';

const A = 365; // anual
const T = 92; // trimestral
const M = 31; // mensual (verificación in situ)

export const AM196_SEED: { section: string; items: Req[] }[] = [
  {
    section: GA,
    items: [
      ['GA-01', 'Plan de Prevención de Riesgos Laborales (1 a 10 trabajadores) aprobado y registrado en el SUT', 'AM 196 Art. 4 y 18; Decisión 584 Art. 11', null, 'documental', 'sst', 'plan de prevencion,plan prevención'],
      ['GA-02', 'Reglamento de Higiene y Seguridad (más de 10 trabajadores) aprobado y registrado en el SUT', 'Código del Trabajo Art. 434; AM 196 Art. 4 y 19', null, 'documental', 'sst', 'reglamento de higiene,reglamento interno'],
      ['GA-03', 'Política de SST socializada a todos los trabajadores', 'Decisión 584 Art. 11', A, 'documental', 'sst', 'politica,política'],
      ['GA-04', 'Registro del Monitor de Seguridad e Higiene en el SUT', 'DE 255 Art. 19; AM 196 Art. 18 y 19', null, 'documental', 'sst', 'monitor'],
      ['GA-05', 'Registro del Técnico de Seguridad e Higiene en el SUT', 'DE 255 Art. 20; AM 196 Art. 18 y 19', null, 'documental', 'sst', 'tecnico de seguridad,técnico,registro tecnico'],
      ['GA-06', 'Registro del Servicio Externo de Seguridad e Higiene en el SUT', 'DE 255 Art. 25; AM 196 Art. 14', null, 'documental', 'sst', 'servicio externo'],
      ['GA-07', 'Informe de actividades del técnico / servicio externo (estadísticas, horas, conclusiones, fotos, firmas)', 'AM 196 Art. 13', T, 'documental', 'sst', 'informe de actividades,informe tecnico'],
      ['GA-08', 'Registro del profesional médico en el SUT', 'DE 255 Art. 21', null, 'documental', 'medico', 'medico+sut,profesional medico,registro medico'],
      ['GA-09', 'Registro del Delegado de Seguridad y Salud en el SUT', 'DE 255 Art. 33; AM 196 Art. 18 y 19', null, 'documental', 'sst', 'delegado'],
      ['GA-10', 'Registro del Comité de Seguridad y Salud en el SUT', 'DE 255 Art. 32; AM 196 Art. 18 y 19', null, 'documental', 'sst', 'comite,comité'],
      ['GA-11', 'Informe de gestión del Organismo Paritario (cronograma, conclusiones, fotos, firmas)', 'Resolución 957 Art. 10, 13, 14; DE 255 Art. 36 y 38', A, 'documental', 'sst', 'organismo paritario,informe de gestion comite'],
      ['GA-12', 'Procedimiento de colaboración en SST con contratistas y subcontratistas (actividades simultáneas)', 'AM 196 Art. 4', A, 'documental', 'sst', 'contratistas,colaboracion,coordinación'],
    ],
  },
  {
    section: GT,
    items: [
      ['GT-01', 'Diagrama de flujo de procesos productivos / de servicios', 'Decisión 584 Art. 11', A, 'documental', 'sst', 'diagrama de flujo,procesos'],
      ['GT-02', 'Descriptivo por puesto de trabajo (trabajadores, tareas, horas, recursos)', 'Decisión 584 Art. 11 y 19; CT Art. 42; DE 255 Art. 28', A, 'documental', 'sst', 'descriptivo,puesto de trabajo,profesiograma'],
      ['GT-03', 'Mapa de riesgos del centro de trabajo (señalización, EPP, paradas de emergencia)', 'Decisión 584 Art. 11', A, 'documental', 'sst', 'mapa de riesgos'],
      ['GT-04', 'Matriz de identificación de peligros y evaluación de riesgos por puesto', 'Decisión 584 Art. 11; Res. 957 Art. 1; DE 255 Art. 27 y 28', A, 'documental', 'sst', 'matriz de riesgos,iper,identificacion de peligros'],
      ['GT-05', 'Informe de medición de agentes físicos, químicos y/o biológicos (con calibración de equipos)', 'Decisión 584 Art. 11, 12, 18; DE 255 Art. 48', A, 'documental', 'sst', 'medicion,dosimetria,sonometria,luxometria,informe+monitoreo'],
      ['GT-06', 'Evaluación de riesgos de seguridad, ergonómicos y psicosociales por puesto', 'Decisión 584 Art. 11, 12, 18; DE 255 Art. 44-46', A, 'documental', 'sst', 'ergonomico,evaluacion+psicosocial,evaluacion de riesgos'],
      ['GT-07', 'Medidas de prevención y protección por puesto (cronograma, jerarquía de controles)', 'Decisión 584 Art. 11; CT Art. 412; DE 255 Art. 49', A, 'documental', 'sst', 'medidas de prevencion,plan de accion,jerarquia'],
      ['GT-08', 'Cálculo del riesgo residual en la matriz de riesgos', 'Resolución 957 Art. 1', A, 'documental', 'sst', 'riesgo residual'],
      ['GT-09', 'Verificación in situ de las medidas de prevención y protección', 'Decisión 584 Art. 11', M, 'in_situ', 'sst', 'verificacion+medidas,verificacion in situ'],
      ['GT-10', 'Limpieza y mantenimiento periódico de luminarias', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'luminaria'],
      ['GT-11', 'Mantenimiento periódico de sistemas de ventilación', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'ventilacion,ventilación'],
      ['GT-12', 'Clasificación de agentes químicos por peligros', 'AM 196 Anexo 3', A, 'documental', 'sst', 'clasificacion+quimico,sga'],
      ['GT-13', 'Recipientes de químicos con tapas o cubiertas adecuadas', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'recipiente'],
      ['GT-14', 'Almacenamiento de químicos por compatibilidad', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'compatibilidad'],
      ['GT-15', 'Fichas de datos de seguridad (FDS/MSDS) disponibles', 'AM 196 Anexo 3', A, 'documental', 'sst', 'msds,fds,hoja de seguridad'],
      ['GT-16', 'Etiquetado de químicos en español', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'etiqueta,etiquetado'],
      ['GT-17', 'Transporte, almacenamiento y manejo de químicos según NTE INEN', 'AM 196 Anexo 3', A, 'documental', 'sst', 'inen 2266,transporte de quimicos'],
      ['GT-18', 'Medidas de bioseguridad para agentes biológicos', 'AM 196 Anexo 3', A, 'documental', 'medico', 'bioseguridad'],
      ['GT-19', 'Área específica para desechos biológicos', 'AM 196 Anexo 3', M, 'in_situ', 'medico', 'desechos biologicos,biopeligrosos'],
      ['GT-20', 'Control de plagas y vectores', 'AM 196 Anexo 3', T, 'documental', 'ambiente', 'plagas,fumigacion,fumigación,vectores'],
      ['GT-21', 'Orden y limpieza de los lugares de trabajo', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'orden y limpieza,5s'],
      ['GT-22', 'Iluminación mínima en áreas de circulación y pasillos', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'iluminacion+pasillo,iluminacion+circulacion'],
      ['GT-23', 'Delimitación de áreas de circulación de personal y vehículos', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'delimitacion+circulacion'],
      ['GT-24', 'Delimitación de áreas de emplazamiento de máquinas', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'delimitacion+maquina'],
      ['GT-25', 'Rampas diseñadas conforme a norma', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'rampa'],
      ['GT-26', 'Estructuras contra caídas de objetos y personas en buen estado', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'baranda,andamio,caidas,caídas'],
      ['GT-27', 'Paradas y pulsadores de emergencia señalizados y accesibles', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'parada de emergencia,pulsador'],
      ['GT-28', 'Resguardos en partes móviles y fijas de máquinas', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'resguardo,guarda'],
      ['GT-29', 'Puertas y salidas señalizadas y libres de obstáculos', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'salidas de emergencia,puertas+salida'],
      ['GT-30', 'Señalización preventiva (NTE INEN-ISO 3864-1)', 'NTE INEN-ISO 3864-1', M, 'in_situ', 'sst', 'señalizacion+preventiva,senalizacion+preventiva'],
      ['GT-31', 'Señalización prohibitiva (NTE INEN-ISO 3864-1)', 'NTE INEN-ISO 3864-1', M, 'in_situ', 'sst', 'señalizacion+prohibitiva,senalizacion+prohibitiva'],
      ['GT-32', 'Señalización informativa (NTE INEN-ISO 3864-1)', 'NTE INEN-ISO 3864-1', M, 'in_situ', 'sst', 'señalizacion+informativa,senalizacion+informativa'],
      ['GT-33', 'Señalización de obligación (NTE INEN-ISO 3864-1)', 'NTE INEN-ISO 3864-1', M, 'in_situ', 'sst', 'señalizacion+obligacion,senalizacion+obligacion'],
      ['GT-34', 'Señalización de equipos contra incendios', 'NTE INEN-ISO 3864-1', M, 'in_situ', 'sst', 'señalizacion+incendio,senalizacion+extintor'],
      ['GT-35', 'Señalización de evacuación en emergencias', 'DE 255 Art. 58; Decisión 584 Art. 11', M, 'in_situ', 'sst', 'señalizacion+evacuacion,ruta de evacuacion'],
      ['GT-36', 'Procedimientos de SST para trabajos especiales (con formato de permiso)', 'DE 255 Art. 58', A, 'documental', 'sst', 'procedimiento,trabajos especiales,alto riesgo'],
      ['GT-37', 'Emisión de permisos de trabajo conforme al procedimiento', 'Decisión 584 Art. 11; DE 255 Art. 58; AM 174 y 13', M, 'documental', 'sst', 'permiso de trabajo,permisos de trabajo'],
      ['GT-38', 'Registros de apertura y cierre de permisos de trabajos especiales', 'Decisión 584 Art. 11; DE 255 Art. 58', M, 'documental', 'sst', 'apertura+permiso,cierre+permiso'],
    ],
  },
  {
    section: TH,
    items: [
      ['TH-01', 'Identificación de trabajadores de grupos prioritarios / vulnerables en la evaluación de riesgos', 'Constitución Art. 35; Decisión 584 Art. 11, 18, 25; LOD Art. 16, 19, 45, 52', A, 'documental', 'medico', 'vulnerable,prioritario,discapacidad'],
      ['TH-02', 'Medidas de prevención in situ para grupos prioritarios / vulnerables', 'Decisión 584 Art. 11 y 27; DE 255 Art. 15', M, 'in_situ', 'medico', 'medidas+vulnerable,medidas+prioritario'],
      ['TH-03', 'Certificación en prevención de riesgos en construcción', 'AM 174 (2017); DE 255 Art. 15', A, 'documental', 'sst', 'certificacion,certificación,construccion'],
      ['TH-04', 'Certificación en prevención de riesgos en energía eléctrica', 'AM 013 (2017); DE 255 Art. 15', A, 'documental', 'sst', 'certificacion electrica,energia electrica'],
      ['TH-05', 'Licencias de conducción acordes para operadores de vehículos y maquinaria', 'Reglamento Ley de Tránsito Art. 132; DE 255 Art. 51', A, 'documental', 'sst', 'licencia'],
      ['TH-06', 'Registro de inducciones y reinducciones en SST (contenido, firmas, evaluación)', 'Decisión 584 Art. 11 y 23; DE 255 Art. 15', M, 'documental', 'sst', 'induccion,inducción,reinduccion'],
      ['TH-07', 'Campañas de comunicación en SST con respaldos', 'Decisión 584 Art. 19; Res. 957 Art. 1', T, 'documental', 'sst', 'campaña,comunicacion,comunicación'],
      ['TH-08', 'Programa de formación, capacitación y entrenamiento en SST (objetivos, cronograma, responsables)', 'Decisión 584 Art. 11 y 23; DE 255 Art. 15, 16, 28; AM 196 Art. 4', A, 'documental', 'sst', 'programa de capacitacion,cronograma de capacitacion'],
      ['TH-09', 'Registros de asistencia a capacitaciones y entrenamientos (temas, firmas, evaluación)', 'Decisión 584 Art. 11 y 23; DE 255 Art. 15, 16, 28', M, 'documental', 'sst', 'registro de asistencia,asistencia+capacitacion'],
      ['TH-10', 'Capacitaciones y entrenamientos registrados en el SUT', 'Decisión 584 Art. 11 y 23; DE 255 Art. 15, 16, 28', T, 'documental', 'sst', 'sut+capacitacion'],
    ],
  },
  {
    section: PO,
    items: [
      ['PO-01', 'Matriz de exámenes médico-ocupacionales por puesto y riesgo', 'Decisión 584 Art. 14 y 22; Res. 957 Art. 5; CT Art. 412; DE 255 Art. 15', A, 'documental', 'medico', 'matriz de examenes,examenes ocupacionales'],
      ['PO-02', 'Cronograma de exámenes médico-ocupacionales', 'Decisión 584 Art. 14 y 22; Res. 957 Art. 5', A, 'documental', 'medico', 'cronograma+examen'],
      ['PO-03', 'Informe de resultados de exámenes médicos por puesto', 'Decisión 584 Art. 14 y 22; Res. 957 Art. 5', A, 'documental', 'medico', 'resultados+examen,informe+examen'],
      ['PO-04', 'Certificados de aptitud médica de ingreso y periódicos firmados', 'Res. 957 Art. 5; DE 255 Art. 15', A, 'documental', 'medico', 'aptitud,certificado medico'],
      ['PO-05', 'Informe trimestral de indicadores de enfermedad común, profesional y accidentes', 'Decisión 584 Art. 11; Res. 957 Art. 1 y 5; CT Art. 42; Res. IESS CD 513 Art. 56', T, 'documental', 'medico', 'trimestral,indicadores,morbilidad'],
      ['PO-06', 'Procedimiento de investigación de accidentes aprobado por la máxima autoridad', 'Decisión 584 Art. 1; Res. 957 Art. 15; Res. IESS CD 513 Art. 1, 12, 47', A, 'documental', 'sst', 'procedimiento+investigacion+accidente'],
      ['PO-07', 'Registro interno de incidentes y accidentes', 'Res. IESS CD 513 Art. 47', M, 'documental', 'sst', 'registro+incidente,registro+accidente'],
      ['PO-08', 'Informes de investigación de accidentes (causas, testigos, acciones, firmas)', 'Res. IESS CD 513 Art. 44', M, 'documental', 'sst', 'investigacion+accidente,informe de investigacion'],
      ['PO-09', 'Reporte del accidente a la autoridad competente', 'Res. IESS CD 513 Art. 53', M, 'documental', 'sst', 'aviso de accidente,reporte+iess,reporte+accidente'],
      ['PO-10', 'Medidas correctivas aplicadas tras accidentes', 'Decisión 584 Art. 11; Res. 957 Art. 5; Res. IESS CD 513 Art. 47', M, 'documental', 'sst', 'medidas correctivas+accidente,acciones correctivas'],
      ['PO-11', 'Procedimiento de investigación de enfermedades profesionales aprobado', 'Res. IESS CD 513 Art. 45; CT Art. 42', A, 'documental', 'medico', 'procedimiento+enfermedad'],
      ['PO-12', 'Reporte de presunción de enfermedad profesional a la autoridad', 'Res. IESS CD 513 Art. 53; CT Art. 42', T, 'documental', 'medico', 'presuncion'],
      ['PO-13', 'Medidas correctivas para evitar nuevas enfermedades profesionales', 'Res. 957 Art. 1; Decisión 584 Art. 4; DE 255 Art. 28', T, 'documental', 'medico', 'medidas correctivas+enfermedad'],
      ['PO-14', 'Programa anual de inspecciones internas de SST (objetivos, alcance, cronograma, listas)', 'Res. 957 Art. 1; Decisión 584 Art. 4; DE 255 Art. 28', A, 'documental', 'sst', 'programa de inspecciones'],
      ['PO-15', 'Evidencia de inspecciones internas y medidas correctivas', 'Decisión 584 Art. 16; Res. 957 Art. 1; AM 174 Art. 134', M, 'documental', 'sst', 'informe+inspeccion,registro+inspeccion'],
      ['PO-16', 'Plan de emergencias y contingencia (amenazas, procedimientos, mapas, simulacros, brigadas)', 'Decisión 584 Art. 11 y 23; DE 255 Art. 15; AM 196 Art. 4', A, 'documental', 'sst', 'plan de emergencia,contingencia'],
      ['PO-17', 'Informe anual de simulacros (fechas, tipos, participantes, lecciones)', 'Decisión 584 Art. 11 y 23; DE 255 Art. 15; AM 196 Art. 4', A, 'documental', 'sst', 'simulacro'],
      ['PO-18', 'Evidencia de implementación de las acciones del plan de emergencia', 'DE 255 Art. 50', T, 'documental', 'sst', 'brigada'],
      ['PO-19', 'Programa de mantenimiento de instalaciones, vehículos, máquinas y equipos', 'DE 255 Art. 50', A, 'documental', 'sst', 'mantenimiento,programa de mantenimiento'],
      ['PO-20', 'Evidencia de ejecución del programa de mantenimiento', 'Decisión 584 Art. 11 c); DE 255 Art. 56', M, 'documental', 'sst', 'registro+mantenimiento,orden de trabajo,bitacora+mantenimiento'],
      ['PO-21', 'Procedimiento de adquisición de EPP y matriz de EPP por puesto', 'Decisión 584 Art. 11 c); DE 255 Art. 56', A, 'documental', 'sst', 'matriz+epp,procedimiento+epp'],
      ['PO-22', 'Registros de entrega y recepción de EPP y ropa de trabajo firmados', 'Decisión 584 Art. 11; DE 255 Art. 56', M, 'documental', 'sst', 'entrega+epp,registro+epp'],
      ['PO-23', 'Evidencia in situ del uso correcto de EPP, EPC y ropa de trabajo', 'Decisión 584 Art. 11 y 23', M, 'in_situ', 'sst', 'uso+epp,inspeccion+epp'],
      ['PO-24', 'Programa de prevención de riesgos psicosociales implementado (respaldos)', 'AM 082 (2017) Art. 9', A, 'documental', 'medico', 'programa+psicosocial'],
      ['PO-25', 'Programa de riesgos psicosociales registrado en el SUT', 'AM 082 (2017) Art. 9; Acuerdo Interministerial 038 (2019)', A, 'documental', 'medico', 'psicosocial+sut'],
      ['PO-26', 'Programa de prevención de consumo de alcohol, tabaco y otras drogas implementado', 'Acuerdo Interministerial 038 (2019)', A, 'documental', 'medico', 'programa+drogas,programa+alcohol'],
      ['PO-27', 'Programa de prevención de alcohol, tabaco y drogas registrado en el SUT', 'Acuerdo Interministerial 038 (2019)', A, 'documental', 'medico', 'drogas+sut,alcohol+sut'],
    ],
  },
  {
    section: SP,
    items: [
      ['SP-01', 'Botiquín de primeros auxilios', 'CT Art. 430', M, 'in_situ', 'medico', 'botiquin,botiquín'],
      ['SP-02', 'Comedor en condiciones de salubridad (50+ trabajadores a más de 2 km de población)', 'CT Art. 42', M, 'in_situ', 'sst', 'comedor'],
      ['SP-03', 'Salubridad y almacenamiento de alimentos en cocina', 'AM 196 Anexo 3', M, 'in_situ', 'medico', 'cocina,alimentos'],
      ['SP-04', 'Abastecimiento de agua para consumo humano', 'AM 196 Anexo 3', M, 'in_situ', 'medico', 'agua potable,agua'],
      ['SP-05', 'Servicios higiénicos en buen estado y separados por sexo', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'baños,servicios higienicos,sshh'],
      ['SP-06', 'Duchas en buen estado', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'duchas'],
      ['SP-07', 'Lavabos con útiles de aseo personal', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'lavabos,lavamanos'],
      ['SP-08', 'Vestuarios limpios y separados por sexo', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'vestuario,vestidor'],
      ['SP-09', 'Campamentos en buen estado (luz, ventilación, agua, SSHH, comedor, alojamiento)', 'AM 196 Anexo 3', M, 'in_situ', 'sst', 'campamento'],
    ],
  },
];
