import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Folder } from '../entities/folder.entity';
import { DocumentType } from '../entities/document-type.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { AuditService } from '../common/audit.service';

const CARPETAS_ESTANDAR = [
  { code: '01', name: 'Documentación General' },
  { code: '02', name: 'Salud Ocupacional' },
  { code: '03', name: 'Seguridad Industrial' },
  { code: '04', name: 'Gestión Ambiental' },
  { code: '05', name: 'Gestión Laboral' },
  { code: '06', name: 'Gestión Semanal' },
  { code: '07', name: 'Gestión Mensual' },
  { code: '08', name: 'Evidencias Fotográficas' },
  { code: '09', name: 'Cierre del Contrato' },
];

/**
 * Catálogo estándar de tipos documentales por carpeta, basado en los
 * requisitos típicos de cumplimiento SST/legal para contratistas de
 * construcción en Ecuador. Se usa para completar automáticamente
 * cualquier carpeta que le falten tipos, sin duplicar los que ya existan
 * (comparando por nombre dentro de la misma carpeta).
 */
const CATALOGO_ESTANDAR: Record<string, { name: string; hasExpiration: boolean; validityDays?: number }[]> = {
  '01': [
    { name: 'RUC de la empresa', hasExpiration: false },
    { name: 'Contrato de servicios', hasExpiration: false },
    { name: 'Nómina de personal asignado a la obra', hasExpiration: false },
    { name: 'Póliza de responsabilidad civil', hasExpiration: true, validityDays: 365 },
    { name: 'Certificado de cumplimiento de obligaciones patronales (IESS)', hasExpiration: true, validityDays: 30 },
    { name: 'Reglamento interno de trabajo / SST', hasExpiration: false },
  ],
  '02': [
    { name: 'Certificado de afiliación IESS', hasExpiration: true, validityDays: 30 },
    { name: 'Examen médico pre-ocupacional', hasExpiration: false },
    { name: 'Examen médico ocupacional periódico', hasExpiration: true, validityDays: 365 },
    { name: 'Certificado de aptitud médica', hasExpiration: true, validityDays: 365 },
    { name: 'Ficha médica ocupacional', hasExpiration: false },
    { name: 'Programa de vigilancia epidemiológica', hasExpiration: false },
  ],
  '03': [
    { name: 'Certificado de capacitación en trabajo en alturas', hasExpiration: true, validityDays: 180 },
    { name: 'Entrega de EPP', hasExpiration: false },
    { name: 'Permiso de trabajo en caliente', hasExpiration: false },
    { name: 'Permiso de trabajo en espacios confinados', hasExpiration: false },
    { name: 'Matriz de riesgos laborales', hasExpiration: false },
    { name: 'Plan de emergencia y evacuación', hasExpiration: false },
  ],
  '04': [
    { name: 'Plan de manejo ambiental', hasExpiration: false },
    { name: 'Licencia ambiental del proyecto', hasExpiration: true, validityDays: 365 },
    { name: 'Registro de generador de desechos peligrosos', hasExpiration: false },
    { name: 'Certificado de gestión de residuos', hasExpiration: false },
  ],
  '05': [
    { name: 'Roles de pago', hasExpiration: false },
    { name: 'Comprobantes de pago IESS', hasExpiration: false },
    { name: 'Contratos individuales de trabajo', hasExpiration: false },
    { name: 'Certificado de no adeudar al IESS', hasExpiration: true, validityDays: 30 },
  ],
  '06': [
    { name: 'Reporte semanal de actividades', hasExpiration: false },
    { name: 'Reporte semanal de seguridad', hasExpiration: false },
    { name: 'Registro de charla de 5 minutos', hasExpiration: false },
  ],
  '07': [
    { name: 'Reporte mensual de indicadores SST', hasExpiration: false },
    { name: 'Estadísticas de accidentabilidad', hasExpiration: false },
    { name: 'Informe mensual de cumplimiento', hasExpiration: false },
  ],
  '08': [
    { name: 'Fotografías de avance de obra', hasExpiration: false },
    { name: 'Fotografías de uso de EPP', hasExpiration: false },
    { name: 'Fotografías de señalización', hasExpiration: false },
  ],
  '09': [
    { name: 'Acta de finalización de obra', hasExpiration: false },
    { name: 'Paz y salvo', hasExpiration: false },
    { name: 'Certificado de conformidad final', hasExpiration: false },
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

    // Generar automáticamente la estructura documental estándar
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

    // Completar el catálogo estándar de tipos documentales de una vez,
    // así el proyecto nace ya con toda la información necesaria.
    await this.ensureStandardDocumentTypes(saved.id);

    return saved;
  }

  /**
   * Un contratista SOLO ve los proyectos a los que fue asignado.
   * Admin, Coordinador SST y Director ven todos.
   */
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

    // Completa automáticamente cualquier tipo documental estándar que
    // falte en cada carpeta (sin duplicar los que ya existan). Así, un
    // proyecto creado antes de ampliar el catálogo se autocompleta la
    // primera vez que alguien lo abre, sin necesidad de ningún botón.
    await this.ensureStandardDocumentTypes(id);

    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: { folders: { documentTypes: true } },
    });
    return project!;
  }

  /**
   * Revisa las 9 carpetas estándar del proyecto y crea los tipos
   * documentales del catálogo que aún no existan en cada una
   * (comparando por nombre). Es seguro llamarlo repetidamente: nunca
   * duplica ni borra nada existente.
   */
  private async ensureStandardDocumentTypes(projectId: string) {
    const folders = await this.foldersRepo.find({
      where: { project: { id: projectId } },
      relations: { documentTypes: true },
    });

    for (const folder of folders) {
      const catalogo = CATALOGO_ESTANDAR[folder.code];
      if (!catalogo) continue;

      const existingNames = new Set(folder.documentTypes.map((t) => t.name));
      const faltantes = catalogo.filter((c) => !existingNames.has(c.name));

      for (const tipo of faltantes) {
        await this.typesRepo.save(
          this.typesRepo.create({
            name: tipo.name,
            hasExpiration: tipo.hasExpiration,
            validityDays: tipo.validityDays,
            folder,
          }),
        );
      }
    }
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
