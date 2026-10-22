import { describe, expect, it } from 'vitest';
import { deriveMssdPrefix, resolveCkoBaseUrls } from '../../src/clients/cko-hosts';

const CLIENT_ID = 'cli_vkuhvk4vjn2edkps7dfsq6emqm';

describe('deriveMssdPrefix', () => {
  it('returns the first 8 characters after cli_', () => {
    expect(deriveMssdPrefix(CLIENT_ID)).toBe('vkuhvk4v');
  });

  it('lowercases and trims the client ID', () => {
    expect(deriveMssdPrefix('  CLI_VKUHVK4VJN2EDKPS  ')).toBe('vkuhvk4v');
  });

  it.each(['', 'vkuhvk4vjn2edkps', 'cli_short', 'cli_vkuhvk4v-jn2e', 'ack_vkuhvk4vjn2e'])(
    'rejects invalid client ID "%s"',
    (clientId) => {
      expect(() => deriveMssdPrefix(clientId)).toThrow(/Invalid Checkout\.com client ID/);
    },
  );
});

describe('resolveCkoBaseUrls', () => {
  it('derives production hosts', () => {
    expect(resolveCkoBaseUrls({ environment: 'production', clientId: CLIENT_ID })).toEqual({
      prefix: 'vkuhvk4v',
      apiBaseUrl: 'https://vkuhvk4v.api.checkout.com',
      accessBaseUrl: 'https://vkuhvk4v.access.checkout.com',
    });
  });

  it('derives sandbox hosts', () => {
    expect(resolveCkoBaseUrls({ environment: 'sandbox', clientId: CLIENT_ID })).toEqual({
      prefix: 'vkuhvk4v',
      apiBaseUrl: 'https://vkuhvk4v.api.sandbox.checkout.com',
      accessBaseUrl: 'https://vkuhvk4v.access.sandbox.checkout.com',
    });
  });

  it.each([
    ['production', 'https://api.checkout.com', 'https://access.checkout.com'],
    ['sandbox', 'https://api.sandbox.checkout.com', 'https://access.sandbox.checkout.com'],
  ] as const)('falls back to the shared hosts without client ID (%s)', (environment, api, access) => {
    expect(resolveCkoBaseUrls({ environment })).toEqual({
      prefix: undefined,
      apiBaseUrl: api,
      accessBaseUrl: access,
    });
  });

  it('uses explicit overrides over the derived hosts', () => {
    const result = resolveCkoBaseUrls({
      environment: 'production',
      clientId: CLIENT_ID,
      apiBaseUrl: 'https://custom.api.checkout.com/',
      accessBaseUrl: 'https://custom.access.checkout.com',
    });

    expect(result.apiBaseUrl).toBe('https://custom.api.checkout.com');
    expect(result.accessBaseUrl).toBe('https://custom.access.checkout.com');
  });

  it('allows overriding only one host', () => {
    const result = resolveCkoBaseUrls({
      environment: 'sandbox',
      clientId: CLIENT_ID,
      apiBaseUrl: 'https://custom.api.sandbox.checkout.com',
    });

    expect(result.apiBaseUrl).toBe('https://custom.api.sandbox.checkout.com');
    expect(result.accessBaseUrl).toBe('https://vkuhvk4v.access.sandbox.checkout.com');
  });

  it('rejects a sandbox host in production', () => {
    expect(() =>
      resolveCkoBaseUrls({ environment: 'production', apiBaseUrl: 'https://abcd1234.api.sandbox.checkout.com' }),
    ).toThrow(/sandbox host .* cannot be used in production/);
  });

  it('rejects a production host in sandbox', () => {
    expect(() =>
      resolveCkoBaseUrls({ environment: 'sandbox', accessBaseUrl: 'https://abcd1234.access.checkout.com' }),
    ).toThrow(/production host .* cannot be used in sandbox/);
  });

  it.each(['not a url', 'http://abcd1234.api.checkout.com', 'https://evil.example.com'])(
    'rejects invalid override "%s"',
    (apiBaseUrl) => {
      expect(() => resolveCkoBaseUrls({ environment: 'production', apiBaseUrl })).toThrow(/Invalid Checkout\.com/);
    },
  );
});
