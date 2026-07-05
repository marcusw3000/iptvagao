import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe } from '@nestjs/common'
import fastifyMultipart from '@fastify/multipart'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  )

  // Capture raw body for webhook HMAC verification (skip multipart — let @fastify/multipart read the stream itself)
  const fastify = app.getHttpAdapter().getInstance()
  fastify.addHook('preParsing', async (req: any, _reply: unknown, payload: AsyncIterable<Buffer>) => {
    const contentType = req.headers['content-type'] ?? ''
    if (contentType.startsWith('multipart/form-data')) {
      return payload
    }

    const chunks: Buffer[] = []
    for await (const chunk of payload) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const rawBody = Buffer.concat(chunks)
    req.rawBody = rawBody
    const { Readable } = await import('stream')
    const stream = new Readable()
    stream.push(rawBody)
    stream.push(null)
    return stream
  })

  // 200MB: cobre upload de APK (app-releases), bem maior que o necessário pra logos de canal
  await app.register(fastifyMultipart, {
    limits: { fileSize: 200 * 1024 * 1024 },
  })

  app.setGlobalPrefix('api/v1')

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.enableCors({
    origin: (process.env.WEB_URL || 'http://localhost:3000').split(','),
    credentials: true,
  })

  const port = process.env.PORT || 3001
  await app.listen(port, '0.0.0.0')
  console.log(`API running on port ${port}`)
}

bootstrap()
