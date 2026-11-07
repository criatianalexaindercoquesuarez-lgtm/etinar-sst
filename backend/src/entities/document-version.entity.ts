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
  filePath: string; // ruta local (fallback si R2 no está configurado)

  @Column({ nullable: true })
  fileHash: string;

  // --- Almacenamiento permanente en Cloudflare R2 ---
  @Column({ nullable: true })
  r2Key: string; // clave del objeto en el bucket de R2

  @Column({ type: 'varchar', default: 'local' })
  storageProvider: string; // 'r2' | 'db' | 'local' (legacy: disco temporal)

  // --- Almacenamiento permanente en la base de datos (tabla stored_files) ---
  @Column({ type: 'varchar', nullable: true })
  storedFileId: string;

  @Column({ type: 'integer', nullable: true })
  fileSize: number;

  @Column({ type: 'varchar', nullable: true })
  contentType: string;

  @ManyToOne(() => User, { nullable: true })
  uploadedBy: User;

  @Column({ nullable: true })
  uploadedByName: string;

  @Column({ default: false })
  uploadedViaPublicLink: boolean;

  @CreateDateColumn()
  uploadedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  reviewStatus: string;

  @ManyToOne(() => User, { nullable: true })
  reviewedBy: User;

  @Column({ type: process.env.DATABASE_URL ? 'timestamp' : 'datetime', nullable: true })
  reviewedAt: Date;

  @Column({ type: 'text', nullable: true })
  reviewComments: string;

  @Column({ nullable: true })
  sharePointUrl: string;

  @Column({ default: false })
  sharePointSynced: boolean;
}
