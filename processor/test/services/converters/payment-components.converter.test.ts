import { PaymentComponentsConverter } from '../../../src/services/converters/payment-components.converter';
import { beforeEach, describe, expect, test } from 'vitest';
describe('PaymentComponentsConverter', () => {
  let converter: PaymentComponentsConverter;

  beforeEach(() => {
    converter = new PaymentComponentsConverter();
  });

  describe('convertResponse', () => {
    test('should return all supported payment components', () => {
      const result = converter.convertResponse();

      expect(result).toBeDefined();
      expect(result.dropins).toEqual([]);
      expect(result.components).toBeDefined();
      expect(Array.isArray(result.components)).toBe(true);
    });

    test('should return empty express array', () => {
      const result = converter.convertResponse();

      expect(result.express).toEqual([]);
    });

    test('should return empty dropins array', () => {
      const result = converter.convertResponse();

      expect(result.dropins).toEqual([]);
      expect(result.dropins.length).toBe(0);
    });

    test('should include ACH component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'ach' });
    });

    test('should include Alma component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'alma' });
    });

    test('should include Apple Pay component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'applepay' });
    });

    test('should include Bizum component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'bizum' });
    });

    test('should include Card component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'card' });
    });

    test('should include EPS component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'eps' });
    });

    test('should include iDEAL component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'ideal' });
    });

    test('should include Google Pay component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'googlepay' });
    });

    test('should include Klarna component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'klarna' });
    });

    test('should include MB WAY component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'mbway' });
    });

    test('should include PayPal component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'paypal' });
    });

    test('should include Przelewy24 component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'przelewy24' });
    });

    test('should include SEPA component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'sepa' });
    });

    test('should include Vipps component', () => {
      const result = converter.convertResponse();

      expect(result.components).toContainEqual({ type: 'vipps' });
    });

    test('should return consistent structure on multiple calls', () => {
      const result1 = converter.convertResponse();
      const result2 = converter.convertResponse();

      expect(result1).toEqual(result2);
    });
  });
});
