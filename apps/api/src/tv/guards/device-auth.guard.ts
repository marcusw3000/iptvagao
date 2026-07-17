import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import type { DeviceTokenPayload } from '../tv.service'
import { tvErrors } from '../tv.errors'

export interface AuthenticatedDevice {
  deviceId: string
  clientId: string
}

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const header: string | undefined = request.headers?.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    if (!token) throw tvErrors.deviceTokenMissing()

    let payload: DeviceTokenPayload
    try {
      payload = await this.jwtService.verifyAsync<DeviceTokenPayload>(token)
    } catch {
      throw tvErrors.deviceTokenInvalid()
    }
    if (payload.kind !== 'device') throw tvErrors.deviceTokenInvalid()

    const device = await this.prisma.device.findUnique({
      where: { id: payload.sub },
      select: { id: true, clientId: true, activated: true },
    })
    if (!device || !device.activated) throw tvErrors.deviceRevoked()

    request.device = { deviceId: device.id, clientId: device.clientId } satisfies AuthenticatedDevice
    return true
  }
}
