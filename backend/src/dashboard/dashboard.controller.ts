import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  summary(@Req() req: any) {
    return this.dashboardService.getSummary(req.user);
  }

  @Get('by-project')
  byProject(@Req() req: any) {
    return this.dashboardService.getByProject(req.user);
  }

  @Get('by-contractor')
  byContractor(@Req() req: any) {
    return this.dashboardService.getByContractor(req.user);
  }
}
