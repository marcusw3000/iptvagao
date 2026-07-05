import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient
  private readonly bucket: string

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    )
    this.bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'channel-logos'
  }

  async uploadChannelLogo(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const path = `${Date.now()}-${filename}`
    const { error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    })
    if (error) throw error

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path)
    return data.publicUrl
  }
}
