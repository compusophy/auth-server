import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateNonce } from '../nonce.js';
import { Config } from '../../config.js';
import { ResponseError } from '../../errors.js';

describe('generateNonce', () => {
  const mockConfig: Config = { origin: 'https://test.example.com' };
  const mockNonce = { nonce: 'test-nonce-123' };

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('should call the nonce endpoint with correct parameters', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNonce,
    });

    await generateNonce(mockConfig);

    expect(fetch).toHaveBeenCalledWith(
      'https://test.example.com/nonce',
      { method: 'POST' }
    );
  });

  it('should return the nonce when request succeeds', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockNonce,
    });

    const result = await generateNonce(mockConfig);

    expect(result).toEqual(mockNonce);
  });

  it('should throw a ResponseError when request fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    try {
      await generateNonce(mockConfig);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ResponseError);
      expect((error as Error).message).toContain('Request failed with status 500');
    }
  });
});
