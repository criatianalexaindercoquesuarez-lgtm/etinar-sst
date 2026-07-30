import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../entities/user.entity';
import { Project, ProjectStatus } from '../entities/project.entity';
import { Contractor, ContractorStatus } from '../entities/contractor.entity';
import { ContractorProject } from '../entities/contractor-project.entity';
import { Worker } from '../entities/worker.entity';
import { Folder } from '../entities/folder.entity';
import { DocumentType } from '../entities/document-type.entity';

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
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    @InjectRepository(Worker) private workersRepo: Repository<Worker>,
    @InjectRepository(Folder) private foldersRepo: Repository<Folder>,
    @InjectRepository(DocumentType) private typesRepo: Repository<DocumentType>,
  ) {}

  async run() {
    const existing = await this.usersRepo.count();
    if (existing > 0) {
      this.logger.log('Ya existen datos, se omite el seed.');
      return;
    }
    this.logger.log('Sembrando datos de demostración...');

    const passwordHash = await bcrypt.hash('Etinar2026!', 10);

    // Proyecto de ejemplo
    const project = await this.projectsRepo.save(
      this.projectsRepo.create({
        code: 'PRY-001',
        name: 'Ampliación Planta Industrial Quito',
        client: 'Cliente Corporativo S.A.',
        city: 'Quito',
        status: ProjectStatus.ACTIVO,
        startDate: '2026-01-15',
        director: 'Ing. María Fernanda Salas',
        sstCoordinator: 'Ing. Carlos Andrade',
      }),
    );

    // Estructura documental estándar
    const folders: Folder[] = [];
    for (const c of CARPETAS_ESTANDAR) {
      const folder = await this.foldersRepo.save(
        this.foldersRepo.create({ code: c.code, name: c.name, project }),
      );
      folders.push(folder);
    }

    // Tipos documentales de ejemplo en un par de carpetas clave
    const saludOcupacional = folders.find((f) => f.code === '02');
    const seguridadIndustrial = folders.find((f) => f.code === '03');
    const docGeneral = folders.find((f) => f.code === '01');

    await this.typesRepo.save([
      this.typesRepo.create({
        name: 'Certificado de afiliación IESS',
        hasExpiration: true,
        validityDays: 30,
        folder: saludOcupacional,
      }),
      this.typesRepo.create({
        name: 'Examen médico ocupacional',
        hasExpiration: true,
        validityDays: 365,
        folder: saludOcupacional,
      }),
      this.typesRepo.create({
        name: 'Certificado de capacitación en trabajo en alturas',
        hasExpiration: true,
        validityDays: 180,
        folder: seguridadIndustrial,
      }),
      this.typesRepo.create({
        name: 'Entrega de EPP',
        hasExpiration: false,
        folder: seguridadIndustrial,
      }),
      this.typesRepo.create({
        name: 'RUC de la empresa',
        hasExpiration: false,
        folder: docGeneral,
      }),
      this.typesRepo.create({
        name: 'Contrato de servicios',
        hasExpiration: false,
        folder: docGeneral,
      }),
    ]);

    // Contratista de ejemplo
    const contractor = await this.contractorsRepo.save(
      this.contractorsRepo.create({
        legalName: 'Construcciones y Montajes del Pacífico Cía. Ltda.',
        legalRepresentative: 'Juan Pablo Ríos',
        ruc: '1792345678001',
        address: 'Av. Amazonas N34-56, Quito',
        email: 'contacto@cmpacifico.ec',
        phone: '+593 99 123 4567',
        status: ContractorStatus.ACTIVO,
      }),
    );

    await this.contractorProjectsRepo.save(
      this.contractorProjectsRepo.create({ contractor, project }),
    );

    await this.workersRepo.save([
      this.workersRepo.create({
        fullName: 'Pedro Morales',
        idNumber: '1712345678',
        position: 'Soldador',
        contractor,
      }),
      this.workersRepo.create({
        fullName: 'Ana Lucía Torres',
        idNumber: '1723456789',
        position: 'Supervisora SST',
        contractor,
      }),
    ]);

    // Usuarios de demostración
    await this.usersRepo.save([
      this.usersRepo.create({
        email: 'admin@etinar.com',
        password: passwordHash,
        fullName: 'Administrador ETINAR',
        role: UserRole.ADMIN,
      }),
      this.usersRepo.create({
        email: 'sst@etinar.com',
        password: passwordHash,
        fullName: 'Carlos Andrade',
        role: UserRole.COORDINADOR_SST,
      }),
      this.usersRepo.create({
        email: 'director@etinar.com',
        password: passwordHash,
        fullName: 'María Fernanda Salas',
        role: UserRole.DIRECTOR,
      }),
      this.usersRepo.create({
        email: 'contratista@cmpacifico.ec',
        password: passwordHash,
        fullName: 'Juan Pablo Ríos',
        role: UserRole.CONTRATISTA,
        contractor,
      }),
    ]);

    this.logger.log('Seed completo. Contraseña para todos los usuarios demo: Etinar2026!');
  }
}
