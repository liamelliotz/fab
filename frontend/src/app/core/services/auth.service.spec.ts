import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { API_URL } from '../constants/api.constants';

const modoOriginal = environment.modoDemo;
describe('Modo de autenticação por environment', () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    environment.modoDemo = modoOriginal;
    localStorage.clear(); sessionStorage.clear();
  });
  it('modoDemo=false usa login HTTP e impede a troca por uma conta demo', () => {
    environment.modoDemo = false;
    const auth = TestBed.inject(AuthService);
    expect(auth.modoDemo).toBe(false);
    expect(auth.entrarComoDemo('demo-admin')).toBe(false);
    const payload = btoa(JSON.stringify({ sub: 'u1', email: 'ana@example.com', perfil: 'usuario', exp: Math.floor(Date.now() / 1000) + 3600 }));
    const token = `e30.${payload}.assinatura`;
    const receber = vi.fn();
    auth.login({ email: 'ana@example.com', senha: 'exemplo123' }).subscribe(receber);
    const req = TestBed.inject(HttpTestingController).expectOne(`${API_URL}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'ana@example.com', senha: 'exemplo123' });
    const dados = { tokenAcesso: token, tipoToken: 'Bearer', expiraEm: 3600, usuario: { nome: 'Ana' } };
    req.flush({ sucesso: true, dados });
    expect(receber).toHaveBeenCalledWith(dados);
    expect(auth.obterToken()).toBe(token);
    expect(auth.obterPerfil()).toBe('usuario');
  });
  it('modoDemo=true mantém a troca de contas e a sessão local', () => {
    environment.modoDemo = true;
    const auth = TestBed.inject(AuthService);
    expect(auth.entrarComoDemo('demo-professor')).toBe(true);
    expect(auth.obterPerfil()).toBe('usuario');
    expect(sessionStorage.getItem('fab_token')).toBe(auth.obterToken());
  });
});
