import { PRODUCTION_API_URL, LOCAL_API_URL, normalizeApiUrl, getApiBaseUrl } from './oneview-api.service';

describe('OneView API URL Configuration', () => {
  it('should have production URL pointing to https://ek-drishti.onrender.com/api', () => {
    expect(PRODUCTION_API_URL).toBe('https://ek-drishti.onrender.com/api');
  });

  it('should have local URL pointing to http://127.0.0.1:8000/api', () => {
    expect(LOCAL_API_URL).toBe('http://127.0.0.1:8000/api');
  });

  it('should normalize URLs by trimming trailing slashes and ensuring single /api suffix', () => {
    expect(normalizeApiUrl('https://ek-drishti.onrender.com/')).toBe('https://ek-drishti.onrender.com/api');
    expect(normalizeApiUrl('https://ek-drishti.onrender.com/api/')).toBe('https://ek-drishti.onrender.com/api');
    expect(normalizeApiUrl('https://ek-drishti.onrender.com/api')).toBe('https://ek-drishti.onrender.com/api');
    expect(normalizeApiUrl('http://localhost:8000')).toBe('http://localhost:8000/api');
    expect(normalizeApiUrl('')).toBe(PRODUCTION_API_URL);
  });

  it('should construct authentication request URL properly without duplicate /api', () => {
    const authUrl = `${PRODUCTION_API_URL}/auth/login`;
    expect(authUrl).toBe('https://ek-drishti.onrender.com/api/auth/login');
  });
});
