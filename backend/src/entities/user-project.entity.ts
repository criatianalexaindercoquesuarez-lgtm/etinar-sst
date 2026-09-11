import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { User } from './user.entity';
import { Project } from './project.entity';

/**
 * Restringe a un usuario interno (Coordinador SST, Director, Admin) a
 * ver/trabajar solo en los proyectos aquí asignados. Si un usuario NO
 * tiene ninguna fila aquí, mantiene acceso global.
 */
@Entity('user_projects')
export class UserProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
