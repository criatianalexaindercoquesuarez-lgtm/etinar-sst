import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Document } from './document.entity';
import { Project } from './project.entity';

export enum AlertType {
  DOCUMENTO_POR_VENCER = 'documento_por_vencer',
  DOCUMENTO_VENCIDO = 'documento_vencido',
  DOCUMENTO_RECHAZADO = 'documento_rechazado',
  DOCUMENTO_OBSERVADO = 'documento_observado',
  CONTRATISTA_SIN_DOCUMENTACION = 'contratista_sin_documentacion',
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', default: 'warning' })
  type: AlertType | string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  resolved: boolean;

  @ManyToOne(() => Document, { nullable: true, onDelete: 'CASCADE' })
  document: Document;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  project: Project;

  @CreateDateColumn()
  createdAt: Date;
}
