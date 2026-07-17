import { Controller, Post, Body, Get, HttpCode, HttpStatus, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply } from 'fastify'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser } from './decorators/current-user.decorator'
import type { AuthSessionUser } from '@iptvagao/shared'
import { buildAuthCookie, buildClearedAuthCookie, AUTH_COOKIE_MAX_AGE } from './auth-cookie'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const { accessToken, session } = await this.authService.login(dto)
    reply.header('Set-Cookie', buildAuthCookie(accessToken))
    return session
  }

  @Get('me')
  me(@CurrentUser() user: AuthSessionUser) {
    return { user, expiresIn: AUTH_COOKIE_MAX_AGE }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.header('Set-Cookie', buildClearedAuthCookie())
    return { success: true }
  }
}
