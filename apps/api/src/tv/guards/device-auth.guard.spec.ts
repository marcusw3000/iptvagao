import { ExecutionContext } from '@nestjs/common'
import { DeviceAuthGuard } from './device-auth.guard'

describe('DeviceAuthGuard', () => {
  let guard: DeviceAuthGuard
  const jwtService = {
    verifyAsync: jest.fn(),
  }
  const prisma = {
    device: {
      findUnique: jest.fn(),
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    guard = new DeviceAuthGuard(jwtService as any, prisma as any)
  })

  function createContext(authorization?: string): ExecutionContext {
    const request: any = {
      headers: authorization ? { authorization } : {},
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext
  }

  it('returns DEVICE_TOKEN_MISSING when authorization header is absent', async () => {
    await expect(guard.canActivate(createContext())).rejects.toMatchObject({
      response: {
        code: 'DEVICE_TOKEN_MISSING',
        message: 'Token de dispositivo ausente',
      },
      status: 401,
    })
  })

  it('returns DEVICE_TOKEN_INVALID when jwt verification fails', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad token'))

    await expect(guard.canActivate(createContext('Bearer bad-token'))).rejects.toMatchObject({
      response: {
        code: 'DEVICE_TOKEN_INVALID',
        message: 'Token de dispositivo invalido',
      },
      status: 401,
    })
  })

  it('returns DEVICE_REVOKED when device is missing or deactivated', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'device-1', clientId: 'client-1', kind: 'device' })
    prisma.device.findUnique.mockResolvedValue({ id: 'device-1', clientId: 'client-1', activated: false })

    await expect(guard.canActivate(createContext('Bearer valid-token'))).rejects.toMatchObject({
      response: {
        code: 'DEVICE_REVOKED',
        message: 'Dispositivo nao ativado ou revogado',
      },
      status: 401,
    })
  })

  it('attaches authenticated device to the request for valid tokens', async () => {
    const context = createContext('Bearer valid-token')
    const request = context.switchToHttp().getRequest()

    jwtService.verifyAsync.mockResolvedValue({ sub: 'device-1', clientId: 'client-1', kind: 'device' })
    prisma.device.findUnique.mockResolvedValue({ id: 'device-1', clientId: 'client-1', activated: true })

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(request.device).toEqual({ deviceId: 'device-1', clientId: 'client-1' })
  })
})
