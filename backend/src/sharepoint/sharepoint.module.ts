import { Module } from '@nestjs/common';
import { GraphAuthService } from './graph-auth.service';
import { SharePointSyncService } from './sharepoint-sync.service';

@Module({
  providers: [GraphAuthService, SharePointSyncService],
  exports: [GraphAuthService, SharePointSyncService],
})
export class SharePointModule {}
