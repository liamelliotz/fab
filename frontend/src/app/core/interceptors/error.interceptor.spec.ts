import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { API_URL } from '../constants/api.constants';
import { Alert } from '../../shared/components/alert/alert';

describe('Erros HTTP no alerta global', () => {
  let http: HttpTestingController;
  let api: ApiService;
  let avisos: NotificationService;
  let navegar: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({ imports: [Alert], providers: [provideRouter([]),
      provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(ApiService);
    avisos = TestBed.inject(NotificationService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => { http.verify(); avisos.limpar(); localStorage.clear(); sessionStorage.clear(); });
  function falhar(status: number, corpo: string | object, caminho = '/equipamentos') {
    const receberErro = vi.fn();
    api.get(caminho).subscribe({ error: receberErro });
    http.expectOne(`${API_URL}${caminho}`).flush(corpo, { status, statusText: 'Erro de teste' });
    expect(receberErro).toHaveBeenCalledOnce();
  }
  it('400 renderiza mensagem e cada campo inválido, sem redirecionar', () => {
    falhar(400, { mensagem: 'Dados inválidos', erros: ['nome é obrigatório', 'quantidade deve ser positiva'] });
    const fixture = TestBed.createComponent(Alert);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Dados inválidos');
    expect([...el.querySelectorAll('li')].map((li) => li.textContent?.trim()))
      .toEqual(['nome é obrigatório', 'quantidade deve ser positiva']);
    expect(navegar).not.toHaveBeenCalled();
  });
  it('429 avisa e não repete a requisição nem encerra sessão', () => {
    const sair = vi.spyOn(TestBed.inject(AuthService), 'logout');
    falhar(429, { mensagem: 'Limite atingido. Aguarde um minuto.' });
    expect(avisos.notificacoes()[0].tipo).toBe('aviso');
    expect(avisos.notificacoes()[0].mensagem).toContain('Aguarde');
    expect(sair).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });
  it('401 limpa a sessão e vai ao login', () => {
    const auth = TestBed.inject(AuthService);
    auth.entrarComoDemo('demo-admin');
    falhar(401, { mensagem: 'Token expirado' });
    expect(auth.obterToken()).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { sessaoExpirada: 'true' } });
  });
  it('401 no login não dispara novo redirecionamento', () => {
    falhar(401, { mensagem: 'Credenciais inválidas' }, '/auth/login');
    expect(navegar).not.toHaveBeenCalled();
  });
  it('403 protegido volta ao dashboard; login inativo permanece na tela de login', () => {
    falhar(403, { mensagem: 'Sem permissão' });
    expect(navegar).toHaveBeenCalledWith(['/dashboard']);
    navegar.mockClear();
    falhar(403, { mensagem: 'Conta inativa' }, '/auth/login');
    expect(navegar).not.toHaveBeenCalled();
  });
  it('500 sem envelope exibe texto de fallback sem console.warn/error', () => {
    const warn = vi.spyOn(console, 'warn');
    const error = vi.spyOn(console, 'error');
    falhar(500, 'erro interno');
    expect(avisos.notificacoes()[0].mensagem).toContain('Tente novamente');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore(); error.mockRestore();
  });
});
