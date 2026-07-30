import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  summary() {
    return this.dashboardService.getSummary();
  }

  @Get('by-project')
  byProject() {
    return this.dashboardService.getByProject();
  }

  @Get('by-contractor')
  byContractor() {
    return this.dashboardService.getByContractor();
  }
}
