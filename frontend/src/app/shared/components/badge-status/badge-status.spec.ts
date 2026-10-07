import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeStatus } from './badge-status';

describe('BadgeStatus', () => {
  let fixture: ComponentFixture<BadgeStatus>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BadgeStatus] }).compileComponents();
    fixture = TestBed.createComponent(BadgeStatus);
  });

  const casos = [
    ['disponivel', 'Disponível'],
    ['emprestado', 'Emprestado'],
    ['em_manutencao', 'Manutenção'],
    ['pendente', 'Pendente'],
  ] as const;

  casos.forEach(([status, rotulo]) => {
    it(`should render "${rotulo}" for ${status}`, () => {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      const el = (fixture.nativeElement as HTMLElement).querySelector('.badge');
      expect(el?.textContent?.trim()).toBe(rotulo);
      expect(el?.classList).toContain(`badge--${status}`);
    });
  });
});