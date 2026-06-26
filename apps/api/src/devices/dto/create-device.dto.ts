import { IsString, MinLength } from 'class-validator'

export class CreateDeviceDto {
  @IsString()
  clientId: string

  @IsString()
  @MinLength(2)
  name: string
}
