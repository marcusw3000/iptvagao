import { Test, TestingModule } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from '../src/app.module'

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    )

    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

    await app.init()
    await app.getHttpAdapter().getInstance().ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/v1/auth/login — rejects missing body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {},
    })
    expect(response.statusCode).toBe(400)
  })

  it('POST /api/v1/auth/login — rejects invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'noexist', password: 'wrongpass' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('GET /api/v1/users — rejects unauthenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users',
    })
    expect(response.statusCode).toBe(401)
  })
})
