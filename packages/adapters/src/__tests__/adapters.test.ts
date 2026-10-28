import { describe, expect, it } from 'vitest'
import { GA4_SCOPE, GSC_SCOPE } from '../index'

describe('adapters', () => {
  it('exposes read-only OAuth scopes for each Google source', () => {
    expect(GSC_SCOPE).toBe('https://www.googleapis.com/auth/webmasters.readonly')
    expect(GA4_SCOPE).toBe('https://www.googleapis.com/auth/analytics.readonly')
  })
})
