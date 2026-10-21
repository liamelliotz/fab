
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Alert } from './shared/components/alert/alert';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Alert],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}




/* import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('frontend');
} */