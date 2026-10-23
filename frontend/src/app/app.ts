import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `
    <header class="app-header">
      <a class="app-header__brand" routerLink="/">
        <img class="app-header__logo" src="favicon.svg" alt="" width="28" height="28" />
        Generador de QR
      </a>
    </header>
    <main class="app-main">
      <router-outlet />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
