import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Folder } from './folder.entity';

@Entity('document_types')
export class DocumentType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // ej: "Certificado de afiliación IESS"

  @Column({ default: false })
  hasExpiration: boolean; // si aplica fecha de vencimiento

  @Column({ nullable: true })
  validityDays: number; // vigencia típica en días

  @ManyToOne(() => Folder, (f) => f.documentTypes, { onDelete: 'CASCADE' })
  folder: Folder;

  @CreateDateColumn()
  createdAt: Date;
}
