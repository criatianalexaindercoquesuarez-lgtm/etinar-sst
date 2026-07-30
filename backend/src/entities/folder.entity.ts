import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { DocumentType } from './document-type.entity';

@Entity('folders')
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string; // ej: "01", "02"...

  @Column()
  name: string; // ej: "Documentación General"

  @ManyToOne(() => Project, (p) => p.folders, { onDelete: 'CASCADE' })
  project: Project;

  @ManyToOne(() => Folder, { nullable: true })
  parent: Folder; // subcarpetas configurables

  @OneToMany(() => DocumentType, (dt) => dt.folder)
  documentTypes: DocumentType[];

  @CreateDateColumn()
  createdAt: Date;
}
