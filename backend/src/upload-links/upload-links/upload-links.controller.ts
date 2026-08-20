import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UploadLinksService } from './upload-links.service';
import { Roles, RolesGuard } from '../auth/roles.guard';

@Controller('upload-links')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'coordinador_sst')
export class UploadLinksController {
  constructor(private uploadLinksService: UploadLinksService) {}

  @Post('contractor/:contractorId')
  create(
    @Param('contractorId') contractorId: string,
    @Body() body: { expiresInDays?: number },
    @Req() req: any,
  ) {
    return this.uploadLinksService.create(contractorId, req.user, body?.expiresInDays);
  }

  @Get('contractor/:contractorId')
  findByContractor(@Param('contractorId') contractorId: string) {
    return this.uploadLinksService.findByContractor(contractorId);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @Req() req: any) {
    return this.uploadLinksService.revoke(id, req.user);
  }
}
