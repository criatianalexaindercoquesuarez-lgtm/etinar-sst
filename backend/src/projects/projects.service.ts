import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Folder } from '../entities/folder.entity';
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

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Folder) private foldersRepo: Repository<Folder>,
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
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: { folders: { documentTypes: true } },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

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

    return project;
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
