import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Folder } from '../entities/folder.entity';
import { DocumentType } from '../entities/document-type.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { AuditService } from '../common/audit.service';

/**
 * Estructura base oficial de ETINAR S.A. — ver "Estructura de Carpetas –
 * Contratistas/Subcontratistas, Gestión SST ETINAR" (documento de referencia).
 * Esta es la plantilla inicial: el Admin puede agregar carpetas y
 * subcarpetas nuevas desde el sistema sin tocar el código (ver
 * createFolder() más abajo y el endpoint de tipos documentales).
 */
const CARPETAS_ESTANDAR = [
  { code: '01', name: '01_DOCUMENTACION_GENERAL' },
  { code: '02', name: '02_SALUD_OCUPACIONAL' },
  { code: '03', name: '03_SEGURIDAD_INDUSTRIAL' },
  { code: '04', name: '04_GESTION_AMBIENTAL' },
  { code: '05', name: '05_GESTION_LABORAL' },
  { code: '06', name: '06_SEMANAL' },
  { code: '07', name: '07_MENSUAL' },
  { code: '08', name: '08_EVIDENCIAS_FOTOGRAFICAS' },
  { code: '09', name: '09_CIERRE_CONTRATO' },
];

const CATALOGO_ESTANDAR: Record<string, { name: string; hasExpiration: boolean; validityDays?: number }[]> = {
  '01': [
    { name: 'RUC', hasExpiration: false },
    { name: 'Nombramiento Representante Legal', hasExpiration: false },
    { name: 'Contrato / Orden de Servicio', hasExpiration: false },
    { name: 'Carta Responsiva', hasExpiration: false },
    { name: 'Registro IESS', hasExpiration: true, validityDays: 30 },
    { name: 'Nómina de Personal', hasExpiration: false },
    { name: 'Certificados de Competencia', hasExpiration: true, validityDays: 365 },
  ],
  '02': [
    { name: 'Exámenes Médicos', hasExpiration: true, validityDays: 365 },
    { name: 'Certificados de Aptitud Médica', hasExpiration: true, validityDays: 365 },
    { name: 'Vacunas Antitetánicas', hasExpiration: true, validityDays: 3650 },
    { name: 'Fichas Ocupacionales', hasExpiration: false },
    { name: 'Botiquín y Emergencias', hasExpiration: false },
    { name: 'Riesgo Psicosocial', hasExpiration: false },
  ],
  '03': [
    { name: 'Inducciones y Capacitaciones', hasExpiration: true, validityDays: 180 },
    { name: 'Entrega de EPP', hasExpiration: false },
    { name: 'ATS / APR / ADT / PTR', hasExpiration: false },
    { name: 'PETS (Procedimientos Escritos de Trabajo Seguro)', hasExpiration: false },
    { name: 'Matriz IPERC', hasExpiration: false },
    { name: 'Charlas Diarias', hasExpiration: false },
    { name: 'Inspecciones', hasExpiration: false },
    { name: 'Permisos de Alto Riesgo', hasExpiration: false },
    { name: 'Certificados de Operadores', hasExpiration: true, validityDays: 365 },
    { name: 'Equipos y Herramientas', hasExpiration: false },
    { name: 'Incidentes y Accidentes', hasExpiration: false },
  ],
  '04': [
    { name: 'Manejo de Residuos', hasExpiration: false },
    { name: 'Evidencias Fotográficas', hasExpiration: false },
    { name: 'Control de Derrames', hasExpiration: false },
    { name: 'Hojas SDS / MSDS', hasExpiration: false },
    { name: 'Disposición de Escombros', hasExpiration: false },
    { name: 'Control de Polvo y Ruido', hasExpiration: false },
    { name: 'Gestores Ambientales', hasExpiration: false },
  ],
  '05': [
    { name: 'Planillas IESS', hasExpiration: false },
    { name: 'Avisos de Entrada', hasExpiration: false },
    { name: 'Contratos Laborales', hasExpiration: false },
    { name: 'Roles de Pago', hasExpiration: false },
    { name: 'Registro SUT', hasExpiration: false },
    { name: 'Comité Paritario', hasExpiration: false },
    { name: 'Delegado SST', hasExpiration: false },
  ],
  '06': [
    { name: 'Semana 01', hasExpiration: false },
    { name: 'Semana 02', hasExpiration: false },
    { name: 'Semana 03', hasExpiration: false },
    { name: 'Semana 04', hasExpiration: false },
  ],
  '07': [
    { name: 'Enero', hasExpiration: false },
    { name: 'Febrero', hasExpiration: false },
    { name: 'Marzo', hasExpiration: false },
    { name: 'Reportes KPI', hasExpiration: false },
  ],
  '08': [
    { name: 'Actividades', hasExpiration: false },
    { name: 'EPP', hasExpiration: false },
    { name: 'Orden y Limpieza', hasExpiration: false },
    { name: 'Ambiente', hasExpiration: false },
    { name: 'Capacitaciones', hasExpiration: false },
  ],
  '09': [
    { name: 'Acta de Cierre', hasExpiration: false },
    { name: 'Informe Final SST', hasExpiration: false },
    { name: 'Evidencias Finales', hasExpiration: false },
    { name: 'Liquidación Contractual', hasExpiration: false },
  ],
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Folder) private foldersRepo: Repository<Folder>,
    @InjectRepository(DocumentType) private typesRepo: Repository<DocumentType>,
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    private auditService: AuditService,
  ) {}

  async create(data: Partial<Project>, actingUser: any) {
    const project = this.projectsRepo.create(data);
    const saved = await this.projectsRepo.save(project);

    for (const carpeta of CARPETAS_ESTANDAR) {
      await this.foldersRepo.save(
        this.foldersRepo.create({
          code: carpeta.code,
          name: carpeta.name,
          project: saved,
        }),
      );
    }

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'PROJECT_CREATE',
      entityType: 'Project',
      entityId: saved.id,
      details: `Proyecto ${saved.code} - ${saved.name}`,
    });

    await this.ensureStandardDocumentTypes(saved.id);

    return saved;
  }

  async findAll(actingUser: any) {
    if (actingUser?.role === 'contratista') {
      const links = await this.contractorProjectsRepo.find({
        where: { contractor: { id: actingUser.contractorId } },
        relations: { project: true },
      });
      return links
        .map((l) => l.project)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return this.projectsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, actingUser?: any) {
    const exists = await this.projectsRepo.findOne({ where: { id } });
    if (!exists) throw new NotFoundException('Proyecto no encontrado');

    if (actingUser?.role === 'contratista') {
      const link = await this.contractorProjectsRepo.findOne({
        where: {
          project: { id },
          contractor: { id: actingUser.contractorId },
        },
      });
      if (!link) {
        throw new ForbiddenException('Tu empresa no está asignada a este proyecto');
      }
    }

    await this.ensureStandardDocumentTypes(id);

    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: { folders: { documentTypes: true } },
    });
    return project!;
  }

  /**
   * Completa la estructura estándar (carpetas 01-09 + subcarpetas) sin
   * duplicar ni tocar nada que ya exista con otro nombre. Además, renueva
   * el nombre de las carpetas estándar (01-09) para que coincida con la
   * nomenclatura oficial más reciente, sin afectar los documentos ya
   * cargados (se identifican por ID, no por nombre).
   */
  private async ensureStandardDocumentTypes(projectId: string) {
    const folders = await this.foldersRepo.find({
      where: { project: { id: projectId } },
      relations: { documentTypes: true },
    });

    const existingCodes = new Set(folders.map((f) => f.code));

    // Crear cualquier carpeta estándar que falte por completo
    for (const carpeta of CARPETAS_ESTANDAR) {
      if (!existingCodes.has(carpeta.code)) {
        const nueva = await this.foldersRepo.save(
          this.foldersRepo.create({
            code: carpeta.code,
            name: carpeta.name,
            project: { id: projectId } as any,
          }),
        );
        folders.push({ ...nueva, documentTypes: [] } as Folder);
      }
    }

    for (const folder of folders) {
      // Actualizar el nombre a la nomenclatura oficial vigente, si cambió
      const estandar = CARPETAS_ESTANDAR.find((c) => c.code === folder.code);
      if (estandar && folder.name !== estandar.name) {
        await this.foldersRepo.update(folder.id, { name: estandar.name });
      }

      const catalogo = CATALOGO_ESTANDAR[folder.code];
      if (!catalogo) continue;

      const existingNames = new Set((folder.documentTypes || []).map((t) => t.name));
      const faltantes = catalogo.filter((c) => !existingNames.has(c.name));

      for (const tipo of faltantes) {
        await this.typesRepo.save(
          this.typesRepo.create({
            name: tipo.name,
            hasExpiration: tipo.hasExpiration,
            validityDays: tipo.validityDays,
            folder: { id: folder.id } as any,
          }),
        );
      }
    }
  }

  /**
   * Crea una carpeta NUEVA en un proyecto, más allá de las 01-09
   * estándar (ej. "10_NUEVO_REQUISITO"). Pensado para que el Admin la
   * use desde el sistema sin depender de un cambio de código.
   */
  async createFolder(
    projectId: string,
    data: { code: string; name: string },
    actingUser: any,
  ) {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const existing = await this.foldersRepo.findOne({
      where: { project: { id: projectId }, code: data.code },
    });
    if (existing) {
      throw new ConflictException(`Ya existe una carpeta con el código "${data.code}" en este proyecto`);
    }

    const folder = await this.foldersRepo.save(
      this.foldersRepo.create({ code: data.code, name: data.name, project }),
    );

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'FOLDER_CREATE',
      entityType: 'Folder',
      entityId: folder.id,
      details: `Carpeta "${data.code} — ${data.name}" creada en proyecto ${project.code}`,
    });

    return folder;
  }

  async update(id: string, data: Partial<Project>, actingUser: any) {
    await this.findOne(id);
    await this.projectsRepo.update(id, data);
    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email,
      action: 'PROJECT_UPDATE',
      entityType: 'Project',
      entityId: id,
    });
    return this.findOne(id);
  }
}
