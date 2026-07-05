import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import type { DeviceTokenPayload } from '../tv.service'

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
    if (!token) throw new UnauthorizedException('Token de dispositivo ausente')

    let payload: DeviceTokenPayload
    try {
      payload = await this.jwtService.verifyAsync<DeviceTokenPayload>(token)
    } catch {
      throw new UnauthorizedException('Token de dispositivo inválido')
    }
    if (payload.kind !== 'device') throw new UnauthorizedException('Token de dispositivo inválido')

    const device = await this.prisma.device.findUnique({
      where: { id: payload.sub },
      select: { id: true, clientId: true, activated: true },
    })
    if (!device || !device.activated) throw new UnauthorizedException('Dispositivo não ativado')

    request.device = { deviceId: device.id, clientId: device.clientId } satisfies AuthenticatedDevice
    return true
  }
}
