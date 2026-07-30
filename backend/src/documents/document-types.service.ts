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
}
