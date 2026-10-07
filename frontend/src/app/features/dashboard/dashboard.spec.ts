import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Dashboard] }).compileComponents();
    fixture = TestBed.createComponent(Dashboard);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Dashboard heading', () => {
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Dashboard');
  });

  it('should render the search bar with the right placeholder', () => {
    const campo = element.querySelector('input[type="search"]') as HTMLInputElement;
    expect(campo.placeholder).toBe('Pesquisar solicitações');
  });

  it('should render the grid of empty cards', () => {
    expect(element.querySelectorAll('app-card').length).toBe(6);
  });
});