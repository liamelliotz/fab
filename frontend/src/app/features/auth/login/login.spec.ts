import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { API_URL } from '../../../core/constants/api.constants';
import { Login } from './login';

const modoOriginal = environment.modoDemo;

describe('Login com a API (card A6)', () => {
  let http: HttpTestingController;

  function abrir(params: Record<string, string> = {}) {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: convertToParamMap(params) } },
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(Login);
    f.detectChanges();
    return f;
  }

  function entrar(f: ReturnType<typeof abrir>, email: string, senha: string) {
    f.componentInstance.form.setValue({ email, senha });
    f.componentInstance.onSubmit();
    return http.expectOne(`${API_URL}/auth/login`);
  }

  function erroNaTela(f: ReturnType<typeof abrir>): string {
    f.detectChanges();
    return (f.nativeElement.querySelector('.login__error') as HTMLElement)?.textContent?.trim() ?? '';
  }

  beforeEach(() => {
    environment.modoDemo = false;
    localStorage.clear(); sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  afterEach(() => {
    http?.verify();
    environment.modoDemo = modoOriginal;
    localStorage.clear(); sessionStorage.clear();
  });

  it('senha errada, conta bloqueada e excesso de tentativas mostram mensagens diferentes', () => {
    const f = abrir();
    entrar(f, 'professor@fab.com', 'errada1').flush(
      { sucesso: false, mensagem: 'E-mail ou senha incorretos.', erros: [] },
      { status: 401, statusText: 'Unauthorized' },
    );
    const senhaErrada = erroNaTela(f);

    entrar(f, 'carlos@escola.br', 'prof123').flush(
      { sucesso: false, mensagem: 'Conta desativada. Procure a coordenação.', erros: [] },
      { status: 403, statusText: 'Forbidden' },
    );
    const bloqueada = erroNaTela(f);

    entrar(f, 'professor@fab.com', 'errada2').flush(
      { sucesso: false, mensagem: 'Muitas tentativas. Aguarde um pouco e tente novamente.', erros: [] },
      { status: 429, statusText: 'Too Many Requests' },
    );
    const tentativas = erroNaTela(f);

    expect(senhaErrada).toBe('E-mail ou senha incorretos.');
    expect(bloqueada).toBe('Conta desativada. Procure a coordenação.');
    expect(tentativas).toContain('Aguarde um minuto');
    expect(new Set([senhaErrada, bloqueada, tentativas]).size).toBe(3);
  });

  it('login certo guarda o JWT só na sessão da aba e vai para o dashboard', () => {
    const f = abrir();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const payload = btoa(JSON.stringify({ sub: 'usr-professor', perfil: 'usuario', exp: Math.floor(Date.now() / 1000) + 3600 }));
    const req = entrar(f, 'professor@fab.com', 'prof123');
    expect(req.request.body).toEqual({ email: 'professor@fab.com', senha: 'prof123' });
    req.flush({ sucesso: true, dados: { tokenAcesso: `e30.${payload}.assinatura`, usuario: { nome: 'Pedro' } } });
    expect(sessionStorage.getItem('fab_token')).toContain('.assinatura');
    expect(JSON.stringify(localStorage)).not.toContain('prof123');
    expect(navegar).toHaveBeenCalledWith(['/dashboard']);
  });

  it('avisa quando a pessoa volta da troca de senha', () => {
    const f = abrir({ senhaRedefinida: '1' });
    expect(f.nativeElement.querySelector('.login__aviso').textContent).toContain('Senha redefinida');
    expect(f.nativeElement.querySelector('a[href="/recuperar-senha"]')).not.toBeNull();
  });
});
