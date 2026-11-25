import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Navbar } from './navbar';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

// Estes testes usam as contas da demonstração (entrarComoDemo): rodam com o modo demonstração ligado.
const modoDemoDoAmbiente = environment.modoDemo;
beforeEach(() => { environment.modoDemo = true; });
afterEach(() => { environment.modoDemo = modoDemoDoAmbiente; });

// Cria a navbar simulando um usuário logado com o perfil informado
function criarNavbar(perfil: string): { fixture: ComponentFixture<Navbar>; element: HTMLElement } {
  TestBed.inject(AuthService).entrarComoDemo(perfil === 'admin' ? 'usr-admin' : 'usr-professor');
  const fixture = TestBed.createComponent(Navbar);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

const rotulos = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('a.navbar__link .navbar__label')).map((el) =>
    el.textContent?.trim(),
  );

describe('Navbar', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  afterEach(() => sessionStorage.clear());

  it('should create', () => {
    const { fixture } = criarNavbar('admin');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the admin navigation links in the expected order', () => {
    const { element } = criarNavbar('admin');
    expect(rotulos(element)).toEqual([
      'Dashboard',
      'Solicitações',
      'Balcão',
      'Empréstimos',
      'Equipamentos',
      'Manutenção',
      'Insumos',
      'Usuários',
      'Relatórios',
      'Materiais',
      'Configurações',
    ]);
  });

  it('should hide admin-only links for regular users', () => {
    const { element } = criarNavbar('usuario');
    expect(rotulos(element)).toEqual(['Dashboard', 'Materiais', 'Meus pedidos', 'Configurações']);
  });

  it('should render the logout button', () => {
    const { element } = criarNavbar('usuario');
    expect(element.querySelector('button.navbar__sair')).not.toBeNull();
  });
});