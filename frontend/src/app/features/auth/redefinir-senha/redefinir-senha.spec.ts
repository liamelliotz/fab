import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { API_URL } from '../../../core/constants/api.constants';
import { RedefinirSenha } from './redefinir-senha';

const modoOriginal = environment.modoDemo;

describe('Nova senha pelo link (card A6)', () => {
  let http: HttpTestingController;

  function abrir(token?: string) {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { queryParamMap: convertToParamMap(token ? { token } : {}) } },
    });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(RedefinirSenha);
    f.detectChanges();
    return f;
  }

  beforeEach(() => {
    environment.modoDemo = false;
    TestBed.configureTestingModule({
      imports: [RedefinirSenha],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });
  afterEach(() => { http?.verify(); environment.modoDemo = modoOriginal; });

  it('sem token no endereço, explica e oferece um novo link', () => {
    const f = abrir();
    expect(f.nativeElement.textContent).toContain('Link incompleto');
    expect(f.nativeElement.querySelector('form')).toBeNull();
  });

  it('senhas diferentes ou curtas não chamam a API', () => {
    const f = abrir('abc');
    f.componentInstance.form.setValue({ novaSenha: 'curta', confirmacao: 'curta' });
    f.componentInstance.onSubmit();
    f.componentInstance.form.setValue({ novaSenha: 'senha-nova-1', confirmacao: 'senha-nova-2' });
    f.componentInstance.onSubmit(); f.detectChanges();
    http.expectNone(`${API_URL}/auth/redefinir-senha`);
    expect(f.nativeElement.textContent).toContain('As senhas não são iguais');
  });

  it('envia token e senha nova e volta ao login com aviso', () => {
    const f = abrir('token-do-link');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    f.componentInstance.form.setValue({ novaSenha: 'senha-nova-1', confirmacao: 'senha-nova-1' });
    f.componentInstance.onSubmit();
    const req = http.expectOne(`${API_URL}/auth/redefinir-senha`);
    expect(req.request.body).toEqual({ token: 'token-do-link', novaSenha: 'senha-nova-1' });
    req.flush({ sucesso: true, mensagem: 'Senha redefinida. Entre com a nova senha.', dados: null });
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { senhaRedefinida: 1 } });
  });

  it('link já usado mostra a mensagem da API', () => {
    const f = abrir('token-usado');
    f.componentInstance.form.setValue({ novaSenha: 'senha-nova-1', confirmacao: 'senha-nova-1' });
    f.componentInstance.onSubmit();
    http.expectOne(`${API_URL}/auth/redefinir-senha`).flush(
      { sucesso: false, mensagem: 'Este link já foi usado. Peça um novo.', erros: [] },
      { status: 400, statusText: 'Bad Request' },
    );
    f.detectChanges();
    expect(f.nativeElement.querySelector('.login__error').textContent).toContain('Este link já foi usado');
  });
});
