import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentType } from '../entities/document-type.entity';
import { Folder } from '../entities/folder.entity';

@Injectable()
export class DocumentTypesService {
  constructor(
    @InjectRepository(DocumentType) private typesRepo: Repository<DocumentType>,
    @InjectRepository(Folder) private foldersRepo: Repository<Folder>,
  ) {}

  async create(data: {
    folderId: string;
    name: string;
    hasExpiration?: boolean;
    validityDays?: number;
  }) {
    const folder = await this.foldersRepo.findOne({ where: { id: data.folderId } });
    if (!folder) throw new NotFoundException('Carpeta no encontrada');
    const type = this.typesRepo.create({
      name: data.name,
      hasExpiration: data.hasExpiration ?? false,
      validityDays: data.validityDays,
      folder,
    });
    return this.typesRepo.save(type);
  }

  findByFolder(folderId: string) {
    return this.typesRepo.find({ where: { folder: { id: folderId } } });
  }

  /**
   * Renombra o ajusta una subcarpeta (tipo documental) existente.
   * No afecta a los documentos ya cargados con ese tipo: siguen
   * vinculados por ID, no por nombre.
   */
  async update(
    id: string,
    data: { name?: string; hasExpiration?: boolean; validityDays?: number },
  ) {
    const type = await this.typesRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Subcarpeta no encontrada');

    if (data.name !== undefined) type.name = data.name;
    if (data.hasExpiration !== undefined) type.hasExpiration = data.hasExpiration;
    if (data.validityDays !== undefined) type.validityDays = data.validityDays;

    return this.typesRepo.save(type);
  }
}
