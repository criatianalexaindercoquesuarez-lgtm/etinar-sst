import { Entity, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Project } from './project.entity';

/**
 * Restringe a un usuario interno (Coordinador SST, Director, Admin) a
 * ver/trabajar solo en los proyectos aquí asignados. Si un usuario NO
 * tiene ninguna fila aquí, mantiene acceso global (comportamiento
 * histórico, sin romper nada existente).
 */
@Entity('user_projects')
export class UserProject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  project: Project;

  @CreateDateColumn()
  createdAt: Date;
}
