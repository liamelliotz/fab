import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { API_URL } from '../constants/api.constants';

describe('Bearer somente na API protegida', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    TestBed.inject(AuthService).entrarComoDemo('demo-admin');
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); localStorage.clear(); sessionStorage.clear(); });
  it('anexa token à API e não envia para login ou terceiros', () => {
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    for (const [url, deveTer] of [[`${API_URL}/equipamentos`, true], [`${API_URL}/auth/login`, false], ['https://externo.example/teste', false]] as const) {
      http.get(url).subscribe();
      const req = backend.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBe(deveTer);
      req.flush({});
    }
  });
});
