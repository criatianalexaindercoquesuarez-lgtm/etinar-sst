import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Folder } from './folder.entity';
import { DocumentType } from './document-type.entity';
import { Contractor } from './contractor.entity';

@Entity('upload_links')
export class UploadLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  token: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @ManyToOne(() => Contractor, { onDelete: 'CASCADE', nullable: true })
  contractor: Contractor;

  @ManyToOne(() => Folder, { onDelete: 'CASCADE', nullable: true })
  folder: Folder;

  @ManyToOne(() => DocumentType, { onDelete: 'CASCADE', nullable: true })
  documentType: DocumentType;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @Column({ nullable: true })
  usedByEmail: string;

  @Column({ type: 'timestamp', nullable: true })
  usedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
