import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractorProject } from '../entities/contractor-project.entity';
import { UploadLinksService } from '../upload-links/upload-links.service';
import { DocumentsService } from '../documents/documents.service';

@Injectable()
export class PublicUploadService {
  constructor(
    @InjectRepository(ContractorProject)
    private contractorProjectsRepo: Repository<ContractorProject>,
    private uploadLinksService: UploadLinksService,
    private documentsService: DocumentsService,
  ) {}

  /**
   * Devuelve solo lo necesario para mostrar el formulario público:
   * nombre del contratista y sus proyectos con la estructura de
   * carpetas/tipos documentales. No expone nada de otros contratistas.
   */
  async getUploadContext(token: string) {
    const link = await this.uploadLinksService.validateToken(token);

    const contractorProjects = await this.contractorProjectsRepo.find({
      where: { contractor: { id: link.contractor.id } },
      relations: {
        project: { folders: { documentTypes: true } },
      },
    });

    return {
      contractorId: link.contractor.id,
      contractorName: link.contractor.legalName,
      projects: contractorProjects.map((cp) => ({
        id: cp.project.id,
        code: cp.project.code,
        name: cp.project.name,
        folders: cp.project.folders.map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          documentTypes: f.documentTypes.map((t) => ({
            id: t.id,
            name: t.name,
            hasExpiration: t.hasExpiration,
          })),
        })),
      })),
    };
  }

  async uploadViaToken(
    token: string,
    params: {
      projectId: string;
      folderId: string;
      documentTypeId: string;
      file: Express.Multer.File;
      dueDate?: string;
    },
    uploaderName: string,
  ) {
    const link = await this.uploadLinksService.validateToken(token);
    const result = await this.documentsService.upload(
      {
        projectId: params.projectId,
        contractorId: link.contractor.id,
        folderId: params.folderId,
        documentTypeId: params.documentTypeId,
        file: params.file,
        dueDate: params.dueDate,
      },
      null,
      uploaderName,
    );
    await this.uploadLinksService.registerUse(link.id);
    return result;
  }
}
