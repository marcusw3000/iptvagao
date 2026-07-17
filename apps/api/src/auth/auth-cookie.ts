const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60

export const AUTH_COOKIE_NAME = 'iptvagao_session'
export const AUTH_COOKIE_MAX_AGE = ONE_WEEK_SECONDS

function baseAttributes() {
  const isProduction = process.env.NODE_ENV === 'production'
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${AUTH_COOKIE_MAX_AGE}`,
    isProduction ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ')
}

export function buildAuthCookie(token: string) {
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; ${baseAttributes()}`
}

export function buildClearedAuthCookie() {
  const isProduction = process.env.NODE_ENV === 'production'
  const attrs = [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    isProduction ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ')

  return `${AUTH_COOKIE_NAME}=; ${attrs}`
}

export function extractAuthCookie(cookieHeader?: string) {
  if (!cookieHeader) return undefined

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (rawName === AUTH_COOKIE_NAME) {
      return decodeURIComponent(rawValue.join('='))
    }
  }

  return undefined
}
