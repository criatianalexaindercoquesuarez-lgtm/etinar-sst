import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ContractorProject } from './contractor-project.entity';
import { Folder } from './folder.entity';

export enum ProjectStatus {
  ACTIVO = 'activo',
  SUSPENDIDO = 'suspendido',
  CERRADO = 'cerrado',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column()
  client: string;

  @Column()
  city: string;

  @Column({ type: 'varchar', default: ProjectStatus.ACTIVO })
  status: ProjectStatus;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string;

  @Column()
  director: string;

  @Column()
  sstCoordinator: string;

  @OneToMany(() => ContractorProject, (cp) => cp.project)
  contractorProjects: ContractorProject[];

  @OneToMany(() => Folder, (f) => f.project)
  folders: Folder[];

  @CreateDateColumn()
  createdAt: Date;
}
