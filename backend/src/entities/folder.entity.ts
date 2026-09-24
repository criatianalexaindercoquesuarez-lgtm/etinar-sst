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
  code: string;

  @Column()
  name: string;

  @ManyToOne(() => Project, (p) => p.folders, { onDelete: 'CASCADE' })
  project: Project;

  @ManyToOne(() => Folder, { nullable: true })
  parent: Folder;

  @OneToMany(() => DocumentType, (dt) => dt.folder)
  documentTypes: DocumentType[];

  /**
   * Una vez que el catálogo estándar de subcarpetas se completó por
   * primera vez en esta carpeta, se marca en true y NUNCA se vuelve a
   * tocar automáticamente — así, si el Admin renombra o borra una
   * subcarpeta manualmente, el sistema no la "recrea" por accidente
   * en la siguiente visita.
   */
  @Column({ default: false })
  catalogSeeded: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
