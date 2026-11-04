import { Component, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Toast {
  readonly message = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  show(text: string) {
    this.message.set(text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(null), 3200);
  }
}

@Component({
  selector: 'v-toast',
  template: `@if (toast.message(); as m) {
    <div class="toast" role="status">{{ m }}</div>
  }`,
})
export class ToastHost {
  protected toast = inject(Toast);
}
