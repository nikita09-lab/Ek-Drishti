import {
  PRODUCTION_API_URL,
  LOCAL_API_URL,
  normalizeApiUrl,
  getApiBaseUrl
} from './oneview-api.service';

describe('OneView API URL Configuration', () => {
  it('should have the correct production URL', () => {
    expect(PRODUCTION_API_URL).toBe(
      'https://ek-drishti.onrender.com/api'
    );
  });

  it('should have the correct local URL', () => {
    expect(LOCAL_API_URL).toBe(
      'http://127.0.0.1:8000/api'
    );
  });

  describe('normalizeApiUrl', () => {
    it('should add /api to URLs without the suffix', () => {
      expect(normalizeApiUrl('https://ek-drishti.onrender.com'))
        .toBe('https://ek-drishti.onrender.com/api');
    });

    it('should remove trailing slashes', () => {
      expect(normalizeApiUrl('https://ek-drishti.onrender.com/'))
        .toBe('https://ek-drishti.onrender.com/api');
    });

    it('should handle URLs already ending in /api', () => {
      expect(normalizeApiUrl('https://ek-drishti.onrender.com/api'))
        .toBe('https://ek-drishti.onrender.com/api');
    });

    it('should handle URLs ending in /api/', () => {
      expect(normalizeApiUrl('https://ek-drishti.onrender.com/api/'))
        .toBe('https://ek-drishti.onrender.com/api');
    });

    it('should remove duplicate /api suffixes', () => {
      expect(normalizeApiUrl('https://ek-drishti.onrender.com/api/api'))
        .toBe('https://ek-drishti.onrender.com/api');
    });

    it('should support localhost URLs', () => {
      expect(normalizeApiUrl('http://localhost:8000'))
        .toBe('http://localhost:8000/api');
    });

    it('should support 127.0.0.1 URLs', () => {
      expect(normalizeApiUrl('http://127.0.0.1:8000'))
        .toBe('http://127.0.0.1:8000/api');
    });

    it('should use the production URL for empty input', () => {
      expect(normalizeApiUrl('')).toBe(PRODUCTION_API_URL);
    });

    it('should trim whitespace', () => {
      expect(normalizeApiUrl('  https://ek-drishti.onrender.com  '))
        .toBe('https://ek-drishti.onrender.com/api');
    });
  });

  describe('getApiBaseUrl', () => {
    it('should return the production URL in production mode', () => {
      expect(getApiBaseUrl(true)).toBe(PRODUCTION_API_URL);
    });

    it('should return the local URL in development mode', () => {
      expect(getApiBaseUrl(false)).toBe(LOCAL_API_URL);
    });
  });

  it('should construct the authentication URL without duplicate /api', () => {
    const authUrl = `${PRODUCTION_API_URL}/auth/login`;

    expect(authUrl).toBe(
      'https://ek-drishti.onrender.com/api/auth/login'
    );
  });
});