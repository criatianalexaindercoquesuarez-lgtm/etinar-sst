/**
 * DOCUMENTACIÓN INTERNA ETINAR — modelo de datos.
 *
 * Principios:
 *  - OneDrive/SharePoint es la fuente de verdad de los ARCHIVOS. Aquí solo se
 *    guarda un ÍNDICE de metadatos (nombre, ruta, fechas, autor, enlace), nunca
 *    una copia del contenido. Así no se duplican documentos ni se pierde la
 *    estructura original de carpetas.
 *  - Todo cumplimiento se calcula a partir de registros reales (índice de
 *    OneDrive + evidencias + validaciones), nunca se escribe a mano un "%".
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from '../entities/project.entity';
import { User } from '../entities/user.entity';

const TS = process.env.DATABASE_URL ? 'timestamptz' : 'datetime';

export type Discipline = 'sst' | 'ambiente' | 'medico' | 'social';
export const DISCIPLINES: Discipline[] = ['sst', 'ambiente', 'medico', 'social'];
export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  sst: 'Asistente SST',
  ambiente: 'Asistente Ambiental',
  medico: 'Médico / Asistente médico',
  social: 'Gestión Social',
};

export type Frequency =
  | 'semanal'
  | 'quincenal'
  | 'mensual'
  | 'trimestral'
  | 'semestral'
  | 'anual';

/* ------------------------------------------------------------------ */
/* OneDrive / SharePoint                                                */
/* ------------------------------------------------------------------ */

/** Carpeta de OneDrive/SharePoint vinculada a una obra. */
@Entity('int_drive_links')
export class DriveLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  /** Uso de la carpeta: general | sst | ambiente | medico | social | am196 | ministerio */
  @Column({ type: 'varchar', default: 'general' })
  purpose: string;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  /** Enlace pegado por el usuario (compartir de OneDrive/SharePoint) */
  @Column({ type: 'text', nullable: true })
  sourceUrl: string | null;

  /** Subcarpeta dentro del enlace (cuando se vincula la carpeta de una obra desde la carpeta general) */
  @Column({ type: 'text', nullable: true })
  subPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  driveId: string | null;

  @Column({ type: 'varchar', nullable: true })
  itemId: string | null;

  @Column({ type: 'varchar', nullable: true })
  folderName: string | null;

  @Column({ type: 'text', nullable: true })
  webUrl: string | null;

  /** verificado | sin_verificar | error */
  @Column({ type: 'varchar', default: 'sin_verificar' })
  status: string;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: TS, nullable: true })
  lastScanAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  itemCount: number;

  @CreateDateColumn()
  createdAt: Date;
}

/** Índice de metadatos de cada archivo/carpeta de OneDrive (sin contenido). */
@Entity('int_drive_items')
@Index(['linkId', 'itemId'], { unique: true })
export class DriveItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'link_id' })
  linkId: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column()
  driveId: string;

  @Column()
  itemId: string;

  @Column({ type: 'varchar', nullable: true })
  parentItemId: string | null;

  /** Ruta relativa a la carpeta vinculada, ej. "Gestión Semanal/Charlas/charla-01.pdf" */
  @Column({ type: 'text' })
  path: string;

  /** Ruta normalizada (minúsculas, sin tildes) para búsquedas por palabra clave */
  @Column({ type: 'text' })
  pathNorm: string;

  @Column()
  name: string;

  @Column({ default: false })
  isFolder: boolean;

  @Column({ type: 'bigint', nullable: true })
  size: number | null;

  @Column({ type: 'varchar', nullable: true })
  mimeType: string | null;

  @Column({ type: 'text', nullable: true })
  webUrl: string | null;

  @Column({ type: TS, nullable: true })
  fileCreatedAt: Date | null;

  @Column({ type: TS, nullable: true })
  fileModifiedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  createdByName: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdByEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  modifiedByName: string | null;

  @Column({ type: 'varchar', nullable: true })
  modifiedByEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  eTag: string | null;

  /** Ya no existe en OneDrive (se conserva para trazabilidad, nunca se borra). */
  @Column({ default: false })
  removed: boolean;

  @Column({ type: TS })
  firstSeenAt: Date;

  @Column({ type: TS })
  lastSeenAt: Date;
}

/* ------------------------------------------------------------------ */
/* Personal interno por obra                                           */
/* ------------------------------------------------------------------ */

@Entity('int_staff')
export class InternalStaff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column()
  email: string;

  @Column({ type: 'varchar' })
  discipline: Discipline;

  @Column({ type: 'varchar', nullable: true })
  jobTitle: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  /** Usuario del sistema (rol "asistente") si se le dio acceso */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('int_staff_assignments')
export class StaffAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InternalStaff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staff_id' })
  staff: InternalStaff;

  @Column({ name: 'staff_id' })
  staffId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

/* ------------------------------------------------------------------ */
/* Actividades / obligaciones                                          */
/* ------------------------------------------------------------------ */

/** Catálogo de obligaciones periódicas por disciplina (editable). */
@Entity('int_activity_templates')
export class ActivityTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar' })
  discipline: Discipline;

  @Column({ type: 'varchar' })
  frequency: Frequency;

  /** Días después del cierre del período para entregar la evidencia */
  @Column({ type: 'integer', default: 2 })
  graceDays: number;

  /** Cantidad mínima de archivos de evidencia para considerarla ejecutada */
  @Column({ type: 'integer', default: 1 })
  minEvidence: number;

  /** Palabras clave (separadas por coma) para reconocer la evidencia en OneDrive */
  @Column({ type: 'text', nullable: true })
  keywords: string | null;

  /** Subcarpeta sugerida dentro de la carpeta de la obra (para cargas desde el sistema) */
  @Column({ type: 'varchar', nullable: true })
  defaultFolder: string | null;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;
}

/** Ajuste por obra de una obligación (carpeta exacta, aplica o no, responsable). */
@Entity('int_project_activity_config')
@Index(['projectId', 'templateId'], { unique: true })
export class ProjectActivityConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @Column({ default: true })
  enabled: boolean;

  /** Ruta relativa (dentro de una carpeta vinculada) donde se busca la evidencia */
  @Column({ type: 'text', nullable: true })
  folderPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkId: string | null;

  @Column({ type: 'varchar', nullable: true })
  responsibleStaffId: string | null;
}

export type ActivityStatus =
  | 'pendiente'
  | 'ejecutada'
  | 'incompleta'
  | 'vencida'
  | 'no_aplica';

/** Ocurrencia concreta de una obligación en un período (ej. semana 46). */
@Entity('int_activity_instances')
@Index(['projectId', 'templateId', 'periodKey'], { unique: true })
export class ActivityInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ActivityTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: ActivityTemplate;

  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => InternalStaff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'staff_id' })
  staff: InternalStaff | null;

  @Column({ name: 'staff_id', type: 'varchar', nullable: true })
  staffId: string | null;

  @Column()
  periodKey: string;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Column({ type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', default: 'pendiente' })
  status: ActivityStatus;

  @Column({ type: 'integer', default: 0 })
  evidenceCount: number;

  @Column({ type: TS, nullable: true })
  completedAt: Date | null;

  /** Entregada después de la fecha límite */
  @Column({ default: false })
  late: boolean;

  /** auto (OneDrive) | manual (validación de coordinación) */
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  /** Revisión de la Coordinación SST: validada | observada | null */
  @Column({ type: 'varchar', nullable: true })
  review: string | null;

  @Column({ type: 'text', nullable: true })
  reviewComment: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy: string | null;

  @Column({ type: TS, nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

/* ------------------------------------------------------------------ */
/* AM 196                                                              */
/* ------------------------------------------------------------------ */

/** Catálogo de requisitos documentales del AM MDT-2024-196 (Anexo 1). */
@Entity('int_am196_requirements')
export class Am196Requirement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  section: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  legalRef: string | null;

  /** Vigencia en días antes de requerir actualización (null = no vence) */
  @Column({ type: 'integer', nullable: true })
  validityDays: number | null;

  /** documental | in_situ (verificación en campo) */
  @Column({ type: 'varchar', default: 'documental' })
  evidenceType: string;

  @Column({ type: 'varchar', default: 'sst' })
  discipline: Discipline;

  @Column({ type: 'text', nullable: true })
  keywords: string | null;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;
}

export type Am196Status =
  | 'cumple'
  | 'por_actualizar'
  | 'vencido'
  | 'faltante'
  | 'observado'
  | 'no_aplica';

/** Matriz AM 196 de una obra: un registro por requisito. */
@Entity('int_am196_items')
@Index(['projectId', 'requirementId'], { unique: true })
export class Am196Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Am196Requirement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_id' })
  requirement: Am196Requirement;

  @Column({ name: 'requirement_id' })
  requirementId: string;

  @Column({ default: true })
  applies: boolean;

  @Column({ type: 'varchar', nullable: true })
  responsibleStaffId: string | null;

  /** Responsable libre cuando no es personal registrado */
  @Column({ type: 'varchar', nullable: true })
  responsibleName: string | null;

  @Column({ type: 'text', nullable: true })
  folderPath: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkId: string | null;

  @Column({ type: 'varchar', default: 'faltante' })
  status: Am196Status;

  @Column({ type: 'integer', default: 0 })
  evidenceCount: number;

  @Column({ type: 'date', nullable: true })
  lastUpdateDate: string | null;

  @Column({ type: 'date', nullable: true })
  expiresAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  review: string | null;

  @Column({ type: 'text', nullable: true })
  reviewComment: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy: string | null;

  @Column({ type: TS, nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

/* ------------------------------------------------------------------ */
/* Evidencias, alertas, historial, reportes, configuración             */
/* ------------------------------------------------------------------ */

/** Vínculo de un archivo (de OneDrive) con una actividad o requisito AM 196. */
@Entity('int_evidence')
@Index(['targetType', 'targetId', 'driveItemRowId'], { unique: true })
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** activity | am196 */
  @Column()
  targetType: string;

  @Column()
  targetId: string;

  @Column({ name: 'project_id' })
  projectId: string;

  /** Fila del índice int_drive_items (si el archivo ya está en OneDrive) */
  @Column({ type: 'varchar', nullable: true })
  driveItemRowId: string | null;

  /** Archivo cargado desde el sistema aún no subido a OneDrive (respaldo temporal) */
  @Column({ type: 'varchar', nullable: true })
  storedFileId: string | null;

  @Column()
  fileName: string;

  /** Carpeta vinculada donde está (o se subirá) el archivo */
  @Column({ type: 'varchar', nullable: true })
  linkId: string | null;

  /** Ruta relativa a la carpeta vinculada (para pendientes: carpeta destino) */
  @Column({ type: 'text', nullable: true })
  path: string | null;

  @Column({ type: 'text', nullable: true })
  webUrl: string | null;

  @Column({ type: TS, nullable: true })
  fileDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  sha256: string | null;

  /** auto (reconocida en OneDrive) | carga_sistema | manual (vinculada a mano) */
  @Column()
  source: string;

  /** sincronizado | pendiente_onedrive */
  @Column({ type: 'varchar', default: 'sincronizado' })
  syncStatus: string;

  @Column({ type: 'varchar', nullable: true })
  addedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('int_alerts')
@Index(['dedupeKey'], { unique: true })
export class InternalAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'varchar', nullable: true })
  projectId: string | null;

  @Column({ type: 'varchar', nullable: true })
  staffId: string | null;

  /** actividad_vencida | actividad_incompleta | am196_faltante | am196_vencido | am196_por_actualizar | onedrive_error */
  @Column()
  type: string;

  /** alta | media | baja */
  @Column({ default: 'media' })
  severity: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', nullable: true })
  refType: string | null;

  @Column({ type: 'varchar', nullable: true })
  refId: string | null;

  @Column()
  dedupeKey: string;

  @Column({ default: false })
  resolved: boolean;

  @Column({ type: TS, nullable: true })
  resolvedAt: Date | null;

  /** Ya incluida en el correo diario de alertas */
  @Column({ default: false })
  notified: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

/** Historial de seguimiento (cambios de estado, revisiones, comentarios). */
@Entity('int_history')
export class TrackingHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'varchar', nullable: true })
  projectId: string | null;

  @Column()
  targetType: string;

  @Column()
  targetId: string;

  @Column()
  action: string;

  @Column({ type: 'varchar', nullable: true })
  fromStatus: string | null;

  @Column({ type: 'varchar', nullable: true })
  toStatus: string | null;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ type: 'varchar', nullable: true })
  actor: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('int_reports')
export class InternalReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** semanal | mensual */
  @Column()
  type: string;

  @Column()
  periodKey: string;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Column({ type: 'text' })
  recipients: string;

  /** enviado | simulado | error */
  @Column()
  status: string;

  /** auto | manual */
  @Column({ default: 'auto' })
  trigger: string;

  @Column({ type: 'simple-json', nullable: true })
  summary: any;

  @Column({ type: 'varchar', nullable: true })
  triggeredBy: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('int_settings')
export class InternalSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;
}

export const INTERNAL_ENTITIES = [
  DriveLink,
  DriveItem,
  InternalStaff,
  StaffAssignment,
  ActivityTemplate,
  ProjectActivityConfig,
  ActivityInstance,
  Am196Requirement,
  Am196Item,
  Evidence,
  InternalAlert,
  TrackingHistory,
  InternalReport,
  InternalSetting,
];
