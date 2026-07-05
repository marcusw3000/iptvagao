import { Module } from '@nestjs/common'
import { UploadsController } from './uploads.controller'
import { SupabaseModule } from '../supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
