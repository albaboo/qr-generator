import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { defaultDesign, SavedQr } from '../qr/design';
import { QrApi } from '../qr/qr-api';
import { QrEditor } from './qr-editor';

describe('QrEditor', () => {
  let fixture: ComponentFixture<QrEditor>;
  let api: { get: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  const saved: SavedQr = {
    id: 'abc',
    name: 'Web',
    value: 'https://example.com',
    design: { ...defaultDesign(), foreground: '#223344', eyeColor: '#223344' },
    createdAt: '2026-10-16T10:00:00.000Z',
    updatedAt: '2026-10-16T10:00:00.000Z',
  };

  beforeEach(() => {
    api = {
      get: vi.fn().mockResolvedValue(saved),
      create: vi.fn().mockResolvedValue(saved),
      update: vi.fn().mockResolvedValue(saved),
    };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: QrApi, useValue: api }] });
    fixture = TestBed.createComponent(QrEditor);
  });

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function type(selector: string, text: string): void {
    const input = element().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (!input) {
      throw new Error(`No existe ${selector}`);
    }
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  it('crea un QR nuevo y lleva a su página', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
    type('input[type=text]', 'Web');
    type('textarea', 'https://example.com');
    fixture.detectChanges();
    expect(element().querySelector('app-qr-preview img')).not.toBeNull();

    element().querySelector<HTMLButtonElement>('button[type=submit]')?.click();
    await fixture.whenStable();

    expect(api.create).toHaveBeenCalledWith({ name: 'Web', value: 'https://example.com', design: defaultDesign() });
    expect(navigate).toHaveBeenCalledWith(['/qr', 'abc'], expect.objectContaining({ replaceUrl: true }));
  });

  it('carga un QR guardado y guarda los cambios', async () => {
    fixture.componentRef.setInput('id', 'abc');
    await fixture.whenStable();
    expect(api.get).toHaveBeenCalledWith('abc');
    expect(element().querySelector<HTMLInputElement>('input[type=text]')?.value).toBe('Web');

    type('input[type=text]', 'Web nueva');
    await fixture.whenStable();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    element().querySelector<HTMLButtonElement>('button[type=submit]')?.click();
    await fixture.whenStable();

    expect(api.update).toHaveBeenCalledWith('abc', {
      name: 'Web nueva',
      value: 'https://example.com',
      design: saved.design,
    });
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    expect(element().textContent).toContain('Guardado.');
  });

  it('avisa del poco contraste', async () => {
    await fixture.whenStable();
    const color = element().querySelector<HTMLInputElement>('input[type=color]');
    if (!color) {
      throw new Error('No hay selector de color');
    }
    color.value = '#dddddd';
    color.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(element().textContent).toContain('Poco contraste');
  });
});
