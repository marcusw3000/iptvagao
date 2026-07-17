import { BadRequestException } from '@nestjs/common'
import { URL } from 'url'

const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
]

const PRIVATE_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'host.docker.internal',
  'metadata.google.internal',
])

function isPrivateIpv4(hostname: string) {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(hostname))
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase()
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
}

function parseAllowlist(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function isAllowedHost(hostname: string, allowlist: string[]) {
  if (allowlist.length === 0) return false
  return allowlist.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`))
}

export function assertSafeRemoteUrl(input: string, allowlistValue?: string): string {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    throw new BadRequestException('URL remota invalida')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Apenas URLs http/https sao permitidas')
  }

  const hostname = parsed.hostname.toLowerCase()
  const allowlist = parseAllowlist(allowlistValue)

  if (allowlist.length > 0) {
    if (!isAllowedHost(hostname, allowlist)) {
      throw new BadRequestException('Host remoto nao permitido')
    }
    return parsed.toString()
  }

  if (PRIVATE_HOSTNAMES.has(hostname) || isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new BadRequestException('Host remoto nao permitido')
  }

  return parsed.toString()
}
