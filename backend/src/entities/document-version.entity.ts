import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from './user.entity';

@Entity('document_versions')
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, (d) => d.versions, { onDelete: 'CASCADE' })
  document: Document;

  @Column()
  versionNumber: number;

  @Column()
  fileName: string;

  @Column()
  filePath: string; // ruta local (equivalente a S3 key en producción)

  @Column({ nullable: true })
  fileHash: string;

  @ManyToOne(() => User, { nullable: true })
  uploadedBy: User;

  @Column({ nullable: true })
  uploadedByName: string; // nombre capturado cuando se sube vía enlace público (sin cuenta)

  @Column({ default: false })
  uploadedViaPublicLink: boolean;

  @CreateDateColumn()
  uploadedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  reviewStatus: string; // aprobado | observado | rechazado

  @ManyToOne(() => User, { nullable: true })
  reviewedBy: User;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'text', nullable: true })
  reviewComments: string;

  @Column({ nullable: true })
  sharePointUrl: string;

  @Column({ default: false })
  sharePointSynced: boolean;
}
