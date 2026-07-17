import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'
import type { AuthSession, AuthSessionUser, JwtPayload } from '@iptvagao/shared'
import { AUTH_COOKIE_MAX_AGE } from './auth-cookie'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; session: AuthSession }> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    })

    if (!user || !user.active) throw new UnauthorizedException('Credenciais inválidas')

    const valid = await bcrypt.compare(dto.password, user.password)
    if (!valid) throw new UnauthorizedException('Credenciais inválidas')

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      username: user.username,
      role: user.role,
      clientId: user.clientId,
      resellerId: user.resellerId,
    }

    return {
      accessToken: this.jwt.sign(payload),
      session: {
        user: this.toSessionUser(user),
        expiresIn: AUTH_COOKIE_MAX_AGE,
      },
    }
  }

  async validateUser(payload: JwtPayload): Promise<AuthSessionUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        clientId: true,
        resellerId: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return user ? this.toSessionUser(user) : null
  }

  private toSessionUser(user: {
    id: string
    username: string
    email: string | null
    role: string
    clientId: string | null
    resellerId: string | null
  }): AuthSessionUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      resellerId: user.resellerId,
    }
  }
}
