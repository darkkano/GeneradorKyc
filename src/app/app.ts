import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KycService } from './kyc.service';
import { Renderer } from './renderer';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Renderer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly kyc = inject(KycService);

  constructor() {
    void this.kyc.boot();
  }
}
