import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Document } from './document.entity';

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

  @Column({ type: 'varchar' })
  type: AlertType;

  @ManyToOne(() => Document, { nullable: true, onDelete: 'CASCADE' })
  document: Document;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  resolved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
