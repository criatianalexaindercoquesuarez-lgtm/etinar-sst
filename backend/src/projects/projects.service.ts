import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { Folder } from '../entities/folder.entity';
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

  findAll() {
    return this.projectsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const project = await this.projectsRepo.findOne({
      where: { id },
      relations: { folders: { documentTypes: true } },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
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
