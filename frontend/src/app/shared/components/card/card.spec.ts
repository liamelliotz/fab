import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Card } from './card';

@Component({
  imports: [Card],
  template: `<app-card><p class="conteudo">Ola</p></app-card>`,
})
class Host {}

describe('Card', () => {
  it('should create', async () => {
    await TestBed.configureTestingModule({ imports: [Card] }).compileComponents();
    const fixture = TestBed.createComponent(Card);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should project its content', async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.card');
    expect(card?.querySelector('.conteudo')?.textContent).toBe('Ola');
  });
});