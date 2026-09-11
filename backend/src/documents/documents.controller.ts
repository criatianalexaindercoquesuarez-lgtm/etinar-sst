import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { Document, DocumentStatus } from '../entities/document.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { Folder } from '../entities/folder.entity';
import { DocumentType } from '../entities/document-type.entity';
import { Project } from '../entities/project.entity';
import { Contractor } from '../entities/contractor.entity';
import { Alert, AlertType } from '../entities/alert.entity';
import { AuditService } from '../common/audit.service';
import { SharePointSyncService } from '../sharepoint/sharepoint-sync.service';
import { UserProjectsService } from '../user-projects/user-projects.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private documentsRepo: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private versionsRepo: Repository<DocumentVersion>,
    @InjectRepository(Folder) private foldersRepo: Repository<Folder>,
    @InjectRepository(DocumentType) private typesRepo: Repository<DocumentType>,
    @InjectRepository(Project) private projectsRepo: Repository<Project>,
    @InjectRepository(Contractor) private contractorsRepo: Repository<Contractor>,
    @InjectRepository(Alert) private alertsRepo: Repository<Alert>,
    private auditService: AuditService,
    private sharePointSync: SharePointSyncService,
    private userProjectsService: UserProjectsService,
  ) {}

  async upload(params: {
    projectId: string;
    contractorId: string;
    folderId: string;
    documentTypeId: string;
    file: Express.Multer.File;
    dueDate?: string;
  }, actingUser: any | null, uploaderName?: string) {
    if (actingUser?.role === 'contratista' && actingUser.contractorId !== params.contractorId) {
      throw new ForbiddenException('No puedes subir documentos a otra empresa');
    }

    const [project, contractor, folder, documentType] = await Promise.all([
      this.projectsRepo.findOne({ where: { id: params.projectId } }),
      this.contractorsRepo.findOne({ where: { id: params.contractorId } }),
      this.foldersRepo.findOne({ where: { id: params.folderId } }),
      this.typesRepo.findOne({ where: { id: params.documentTypeId } }),
    ]);
    if (!project || !contractor || !folder || !documentType) {
      throw new NotFoundException('Proyecto, contratista, carpeta o tipo documental no válido');
    }
    if (!params.file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    let document = await this.documentsRepo.findOne({
      where: {
        project: { id: project.id },
        contractor: { id: contractor.id },
        folder: { id: folder.id },
        documentType: { id: documentType.id },
      },
      relations: { versions: true },
    });

    if (!document) {
      document = this.documentsRepo.create({
        project,
        contractor,
        folder,
        documentType,
        status: DocumentStatus.PENDIENTE,
        dueDate: params.dueDate,
        versions: [],
      });
      document = await this.documentsRepo.save(document);
    } else {
      document.status = DocumentStatus.PENDIENTE;
      if (params.dueDate) document.dueDate = params.dueDate;
      await this.documentsRepo.save(document);
    }

    const fileBuffer = fs.readFileSync(params.file.path);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existingVersions = await this.versionsRepo.count({
      where: { document: { id: document.id } },
    });

    const version = this.versionsRepo.create({
      document,
      versionNumber: existingVersions + 1,
      fileName: params.file.originalname,
      filePath: params.file.path,
      fileHash: hash,
      uploadedBy: actingUser ? ({ id: actingUser.userId } as any) : undefined,
      uploadedByName: !actingUser ? uploaderName || 'Enlace público (sin nombre)' : undefined,
      uploadedViaPublicLink: !actingUser,
    });
    const savedVersion = await this.versionsRepo.save(version);

    await this.auditService.log({
      userId: actingUser?.userId,
      userEmail: actingUser?.email ?? `enlace-público:${uploaderName || 'sin nombre'}`,
      action: actingUser ? 'DOCUMENT_UPLOAD' : 'DOCUMENT_UPLOAD_PUBLIC_LINK',
      entityType: 'DocumentVersion',
      entityId: savedVersion.id,
      details: `Documento "${documentType.name}" v${savedVersion.versionNumber} — ${contractor.legalName} / ${project.code}`,
    });

    if (this.sharePointSync.configured) {
      const syncResult = await this.sharePointSync.syncDocumentVersion({
        projectCode: project.code,
        contractorName: contractor.legalName,
        folderName: folder.name,
        documentTypeName: documentType.name,
        fileName: params.file.originalname,
        fileBuffer,
      });
      if (syncResult.synced) {
        savedVersion.sharePointSynced = true;
        savedVersion.sharePointUrl = syncResult.webUrl ?? '';
        await this.versionsRepo.save(savedVersion);
      } else {
        await this.auditService.log({
          action: 'SHAREPOINT_SYNC_FAILED',
          entityType: 'DocumentVersion',
          entityId: savedVersion.id,
          details: syncResult.error,
        });
      }
    }

    return this.findOne(document.id);
  }

  async review(
    documentId: string,
    action: 'aprobar' | 'observar' | 'rechazar',
    comments: string,
    actingUser: any,
  ) {
    const document = await this.findOne(documentId);
    const latestVersion = document.versions.sort(
      (a, b) => b.versionNumber - a.versionNumber,
    )[0];
    if (!latestVersion) {
      throw new BadRequestException('El documento no tiene versiones para revisar');
    }

    const statusMap = {
      aprobar: DocumentStatus.APROBADO,
      observar: DocumentStatus.OBSERVADO,
      rechazar: DocumentStatus.RECHAZADO,
    };
    const reviewStatusMap = { aprobar: 'aprobado', observar: 'observado', rechazar: 'rechazado' };

    document.status = statusMap[action];
    if (action === 'aprobar') document.approvedAt = new Date();
    await this.documentsRepo.save(document);

    latestVersion.reviewStatus = reviewStatusMap[action];
    latestVersion.reviewedBy = { id: actingUser.userId } as any;
    latestVersion.reviewedAt = new Date();
    latestVersion.reviewComments = comments;
    await this.versionsRepo.save(latestVersion);

    if (action === 'observar' || action === 'rechazar') {
      await this.alertsRepo.save(
        this.alertsRepo.create({
          type: action === 'observar' ? AlertType.DOCUMENTO_OBSERVADO : AlertType.DOCUMENTO_RECHAZADO,
          document,
          message: `Documento "${document.documentType?.name}" ${action === 'observar' ? 'observado' : 'rechazado'}: ${comments || 'sin comentarios'}`,
        }),
      );
    }

    await this.auditService.log({
      userId: actingUser.userId,
      userEmail: actingUser.email,
      action: `DOCUMENT_${action.toUpperCase()}`,
      entityType: 'Document',
      entityId: document.id,
      details: comments,
    });

    return this.findOne(document.id);
  }

  async findOne(id: string, actingUser?: any) {
    const doc = await this.documentsRepo.findOne({
      where: { id },
      relations: {
        project: true,
        contractor: true,
        folder: true,
        documentType: true,
        versions: { uploadedBy: true, reviewedBy: true },
      },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (actingUser?.role === 'contratista' && actingUser.contractorId !== doc.contractor.id) {
      throw new ForbiddenException('No autorizado para ver este documento');
    }
    return doc;
  }

  findByProject(projectId: string, actingUser?: any) {
    const where: any = { project: { id: projectId } };
    if (actingUser?.role === 'contratista') {
      where.contractor = { id: actingUser.contractorId };
    }
    return this.documentsRepo.find({
      where,
      relations: { contractor: true, folder: true, documentType: true, versions: true },
      order: { createdAt: 'DESC' },
    });
  }

  findByContractor(contractorId: string, actingUser?: any) {
    if (actingUser?.role === 'contratista' && actingUser.contractorId !== contractorId) {
      throw new ForbiddenException('No autorizado para ver los documentos de otra empresa');
    }
    return this.documentsRepo.find({
      where: { contractor: { id: contractorId } },
      relations: { project: true, folder: true, documentType: true, versions: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Documentos pendientes de revisión. Si el usuario (Coordinador SST,
   * Director, Admin) tiene proyectos asignados en UserProject, solo ve
   * los pendientes de ESOS proyectos. Sin asignación, ve todos (default).
   */
  async findPendingReview(actingUser?: any) {
    const where: any = [
      { status: DocumentStatus.PENDIENTE },
      { status: DocumentStatus.EN_REVISION },
    ];

    if (actingUser?.userId) {
      const restrictedIds = await this.userProjectsService.getAssignedProjectIds(actingUser.userId);
      if (restrictedIds.length > 0) {
        where[0].project = { id: In(restrictedIds) };
        where[1].project = { id: In(restrictedIds) };
      }
    }

    return this.documentsRepo.find({
      where,
      relations: {
        contractor: true,
        project: true,
        folder: true,
        documentType: true,
        versions: true,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async getVersionForDownload(versionId: string, actingUser: any) {
    const version = await this.versionsRepo.findOne({
      where: { id: versionId },
      relations: { document: { contractor: true } },
    });
    if (!version) throw new NotFoundException('Versión no encontrada');

    if (
      actingUser.role === 'contratista' &&
      actingUser.contractorId !== version.document.contractor.id
    ) {
      throw new ForbiddenException('No autorizado para ver este documento');
    }

    return version;
  }

  findAlerts() {
    return this.alertsRepo.find({
      where: { resolved: false },
      relations: { document: { contractor: true, documentType: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async runExpirationCheck() {
    const documents = await this.documentsRepo.find({
      where: { status: DocumentStatus.APROBADO },
      relations: { documentType: true, contractor: true },
    });
    const now = new Date();
    const results: Alert[] = [];

    for (const doc of documents) {
      if (!doc.dueDate) continue;
      const due = new Date(doc.dueDate);
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        const alert = await this.alertsRepo.save(
          this.alertsRepo.create({
            type: AlertType.DOCUMENTO_VENCIDO,
            document: doc,
            message: `Documento de ${doc.contractor.legalName} vencido hace ${Math.abs(daysLeft)} día(s)`,
          }),
        );
        results.push(alert);
      } else if (daysLeft <= 30) {
        const alert = await this.alertsRepo.save(
          this.alertsRepo.create({
            type: AlertType.DOCUMENTO_POR_VENCER,
            document: doc,
            message: `Documento de ${doc.contractor.legalName} vence en ${daysLeft} día(s)`,
          }),
        );
        results.push(alert);
      }
    }
    return results;
  }
}
