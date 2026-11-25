import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { API_URL } from '../../core/constants/api.constants';
import { Configuracoes } from './configuracoes';

const modoOriginal = environment.modoDemo;

describe('Configurações com GET /auth/me (card A7)', () => {
  beforeEach(() => {
    environment.modoDemo = false;
    TestBed.configureTestingModule({
      imports: [Configuracoes],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });
  afterEach(() => { environment.modoDemo = modoOriginal; });

  it('mostra os dados que a API devolve', () => {
    const f = TestBed.createComponent(Configuracoes);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_URL}/auth/me`).flush({
      dados: { id: 'usr-ana', nome: 'Ana Lima', email: 'ana@escola.br', perfil: 'usuario', departamento: 'Informática', telefone: '96991110006' },
    });
    f.detectChanges();
    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('Ana Lima');
    expect(texto).toContain('Informática');
    expect(texto).toContain('(96) 99111-0006');
    http.verify();
  });
});
