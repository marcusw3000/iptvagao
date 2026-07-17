import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'

type TvErrorCode =
  | 'ACTIVATION_CODE_INVALID'
  | 'DEVICE_TOKEN_MISSING'
  | 'DEVICE_TOKEN_INVALID'
  | 'DEVICE_REVOKED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'SUBSCRIPTION_INACTIVE'
  | 'TV_LIMIT_REACHED'

function body(code: TvErrorCode, message: string) {
  return { code, message }
}

export const tvErrors = {
  activationCodeInvalid: () =>
    new NotFoundException(body('ACTIVATION_CODE_INVALID', 'Codigo de ativacao invalido')),
  deviceTokenMissing: () =>
    new UnauthorizedException(body('DEVICE_TOKEN_MISSING', 'Token de dispositivo ausente')),
  deviceTokenInvalid: () =>
    new UnauthorizedException(body('DEVICE_TOKEN_INVALID', 'Token de dispositivo invalido')),
  deviceRevoked: () =>
    new UnauthorizedException(body('DEVICE_REVOKED', 'Dispositivo nao ativado ou revogado')),
  subscriptionRequired: () =>
    new ForbiddenException(body('SUBSCRIPTION_REQUIRED', 'Cliente sem assinatura ativa')),
  subscriptionInactive: () =>
    new ForbiddenException(body('SUBSCRIPTION_INACTIVE', 'Assinatura suspensa ou cancelada')),
  tvLimitReached: (limit: number) =>
    new ForbiddenException(body('TV_LIMIT_REACHED', `Limite de ${limit} TV(s) simultanea(s) atingido`)),
}
