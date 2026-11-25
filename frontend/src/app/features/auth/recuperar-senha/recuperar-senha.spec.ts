import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { API_URL } from '../../../core/constants/api.constants';
import { RecuperarSenha } from './recuperar-senha';

const modoOriginal = environment.modoDemo;

describe('Esqueci minha senha (card A6)', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    environment.modoDemo = false;
    TestBed.configureTestingModule({
      imports: [RecuperarSenha],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); environment.modoDemo = modoOriginal; });

  it('envia o e-mail e mostra a mensagem da API', () => {
    const f = TestBed.createComponent(RecuperarSenha); f.detectChanges();
    f.componentInstance.form.setValue({ email: 'professor@fab.com' });
    f.componentInstance.onSubmit();
    const req = http.expectOne(`${API_URL}/auth/recuperar-senha`);
    expect(req.request.body).toEqual({ email: 'professor@fab.com' });
    req.flush({ sucesso: true, mensagem: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.', dados: null });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Pedido enviado');
    expect(f.nativeElement.textContent).toContain('Se o e-mail estiver cadastrado');
  });

  it('e-mail inválido não chama a API', () => {
    const f = TestBed.createComponent(RecuperarSenha); f.detectChanges();
    f.componentInstance.form.setValue({ email: 'sem-arroba' });
    f.componentInstance.onSubmit(); f.detectChanges();
    http.expectNone(`${API_URL}/auth/recuperar-senha`);
    expect(f.nativeElement.textContent).toContain('E-mail inválido');
  });

  it('muitos pedidos seguidos (429) mostram um aviso próprio', () => {
    const f = TestBed.createComponent(RecuperarSenha); f.detectChanges();
    f.componentInstance.form.setValue({ email: 'professor@fab.com' });
    f.componentInstance.onSubmit();
    http.expectOne(`${API_URL}/auth/recuperar-senha`)
      .flush({ mensagem: 'Muitas tentativas.' }, { status: 429, statusText: 'Too Many Requests' });
    f.detectChanges();
    expect(f.nativeElement.querySelector('.login__error').textContent).toContain('Aguarde um minuto');
  });
});
