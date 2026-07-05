import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const RawBody = createParamDecorator((_: unknown, ctx: ExecutionContext): Buffer => {
  const req = ctx.switchToHttp().getRequest<{ rawBody?: Buffer }>()
  return req.rawBody ?? Buffer.alloc(0)
})
