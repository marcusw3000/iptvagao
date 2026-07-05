import { Injectable, NotFoundException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { ChannelsService } from '../channels/channels.service'
import { DevicesService, generateCode } from '../devices/devices.service'

export interface DeviceTokenPayload {
  sub: string
  clientId: string
  kind: 'device'
}

@Injectable()
export class TvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly channelsService: ChannelsService,
    private readonly devicesService: DevicesService,
  ) {}

  async activate(activationCode: string, userAgent?: string) {
    const device = await this.prisma.device.findUnique({
      where: { activationCode: activationCode.toUpperCase().trim() },
    })
    if (!device) throw new NotFoundException('Código de ativação inválido')

    // Rotaciona o código após o resgate: código de ativação é de uso único
    const updated = await this.prisma.device.update({
      where: { id: device.id },
      data: {
        activated: true,
        activationCode: generateCode(6),
        userAgent: userAgent ?? device.userAgent,
        lastSeenAt: new Date(),
      },
      select: { id: true, clientId: true, name: true },
    })

    const payload: DeviceTokenPayload = { sub: updated.id, clientId: updated.clientId, kind: 'device' }
    const token = await this.jwtService.signAsync(payload, { expiresIn: '365d' })

    return { token, deviceId: updated.id, deviceName: updated.name }
  }

  channelsForClient(clientId: string) {
    return this.channelsService.findForClient(clientId)
  }

  heartbeat(deviceId: string, ipAddress?: string) {
    return this.devicesService.heartbeat(deviceId, ipAddress)
  }
}
