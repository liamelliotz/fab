import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { API_URL } from '../constants/api.constants';
import { environment } from '../../../environments/environment';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

describe('Bearer somente na API protegida', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] });
    TestBed.inject(AuthService).entrarComoDemo('usr-admin');
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

describe('Bearer no SSR (card A6)', () => {
  it('no servidor, chamada protegida não sai (não há sessão) e a pública sai normalmente', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    const concluiu = vi.fn();
    http.get(`${API_URL}/usuarios`).subscribe({ complete: concluiu });
    backend.expectNone(`${API_URL}/usuarios`);
    expect(concluiu).toHaveBeenCalled();
    http.post(`${API_URL}/auth/login`, {}).subscribe();
    backend.expectOne(`${API_URL}/auth/login`).flush({});
    backend.verify();
  });
});
