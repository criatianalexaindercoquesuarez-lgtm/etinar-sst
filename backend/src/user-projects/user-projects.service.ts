import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProject } from '../entities/user-project.entity';

@Injectable()
export class UserProjectsService {
  constructor(
    @InjectRepository(UserProject)
    private readonly userProjectRepository: Repository<UserProject>,
  ) {}

  async findByUserId(userId: string): Promise<UserProject[]> {
    return this.userProjectRepository.find({
      where: { userId },
      relations: ['project'],
    });
  }

  async assignProjectToUser(userId: string, projectId: string): Promise<UserProject> {
    const existing = await this.userProjectRepository.findOne({
      where: { userId, projectId },
    });

    if (existing) {
      return existing;
    }

    const userProject = this.userProjectRepository.create({ userId, projectId });
    return this.userProjectRepository.save(userProject);
  }

  async removeProjectFromUser(userId: string, projectId: string): Promise<void> {
    const existing = await this.userProjectRepository.findOne({
      where: { userId, projectId },
    });

    if (!existing) {
      throw new NotFoundException('La asignación no existe.');
    }

    await this.userProjectRepository.remove(existing);
  }
}
