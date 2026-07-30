import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Contractor } from './contractor.entity';
import { Folder } from './folder.entity';
import { DocumentType } from './document-type.entity';
import { DocumentVersion } from './document-version.entity';

export enum DocumentStatus {
  PENDIENTE = 'pendiente',
  EN_REVISION = 'en_revision',
  OBSERVADO = 'observado',
  RECHAZADO = 'rechazado',
  APROBADO = 'aprobado',
  POR_VENCER = 'por_vencer',
  VENCIDO = 'vencido',
  ARCHIVADO = 'archivado',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @ManyToOne(() => Contractor, { onDelete: 'CASCADE' })
  contractor: Contractor;

  @ManyToOne(() => Folder, { onDelete: 'CASCADE' })
  folder: Folder;

  @ManyToOne(() => DocumentType, { onDelete: 'CASCADE' })
  documentType: DocumentType;

  @Column({ type: 'varchar', default: DocumentStatus.PENDIENTE })
  status: DocumentStatus;

  @Column({ type: 'date', nullable: true })
  dueDate: string;

  @Column({ type: 'date', nullable: true })
  issuedDate: string; // fecha de emisión del documento

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date; // fecha de aprobación (se completa automáticamente)

  @Column({ default: false })
  requiresRenewal: boolean; // marcado por el motor cuando pasa a "por vencer" o "vencido"

  @OneToMany(() => DocumentVersion, (v) => v.document)
  versions: DocumentVersion[];

  @CreateDateColumn()
  createdAt: Date;
}
