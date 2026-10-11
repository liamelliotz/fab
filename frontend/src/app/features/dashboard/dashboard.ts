import { Component } from '@angular/core';
import { Card } from '../../shared/components/card/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [Card],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {}