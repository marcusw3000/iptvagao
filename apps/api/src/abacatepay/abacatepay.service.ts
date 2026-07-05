import { Injectable, Logger } from '@nestjs/common'
import { createHmac, timingSafeEqual } from 'crypto'

interface AbacateCustomer {
  id: string
  name: string
  email: string
}

interface AbacateCheckout {
  id: string
  url: string
  status: string
}

@Injectable()
export class AbacatepayService {
  private readonly logger = new Logger(AbacatepayService.name)
  private readonly baseUrl = process.env.ABACATEPAY_API_URL ?? 'https://api.abacatepay.com/v2'
  private readonly apiKey = process.env.ABACATEPAY_API_KEY ?? ''
  private readonly webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET ?? ''

  private get headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
      const json = (await res.json()) as { data: T; success: boolean; error: string | null }
      if (!json.success) throw new Error(`AbacatePay ${path}: ${json.error}`)
      return json.data
    } finally {
      clearTimeout(timeout)
    }
  }

  async createCustomer(data: {
    name: string
    email: string
    taxId?: string
    phone?: string
  }): Promise<AbacateCustomer> {
    return this.request<AbacateCustomer>('POST', '/customers/create', data)
  }

  async ensureProduct(plan: { id: string; name: string; priceInCentavos: number }): Promise<void> {
    try {
      await this.request('POST', '/products/create', {
        externalId: plan.id,
        name: plan.name,
        price: plan.priceInCentavos,
        currency: 'BRL',
      })
    } catch (err) {
      // Product already exists — safe to continue
      this.logger.debug(`ensureProduct: ${(err as Error).message}`)
    }
  }

  async createCheckout(params: {
    customerId: string
    planId: string
    paymentId: string
    returnUrl: string
    completionUrl: string
  }): Promise<AbacateCheckout> {
    return this.request<AbacateCheckout>('POST', '/checkouts/create', {
      customerId: params.customerId,
      methods: ['PIX', 'CARD'],
      externalId: params.paymentId,
      returnUrl: params.returnUrl,
      completionUrl: params.completionUrl,
      items: [{ externalId: params.planId, quantity: 1 }],
    })
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false
    try {
      const expected = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex')
      return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
    } catch {
      return false
    }
  }
}
