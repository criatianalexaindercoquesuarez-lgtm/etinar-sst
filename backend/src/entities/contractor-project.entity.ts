import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { Contractor } from './contractor.entity';
import { Project } from './project.entity';

@Entity('contractor_projects')
export class ContractorProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contractor, (c) => c.contractorProjects, { onDelete: 'CASCADE' })
  contractor: Contractor;

  @ManyToOne(() => Project, (p) => p.contractorProjects, { onDelete: 'CASCADE' })
  project: Project;

  @CreateDateColumn()
  createdAt: Date;
}
