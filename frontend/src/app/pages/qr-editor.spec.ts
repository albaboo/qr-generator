import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { defaultDesign, SavedQr } from '../qr/design';
import { QrApi } from '../qr/qr-api';
import { QrEditor } from './qr-editor';

describe('QrEditor', () => {
  let fixture: ComponentFixture<QrEditor>;
  let api: {
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
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
      remove: vi.fn().mockResolvedValue(undefined),
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

  it('clona un QR: parte de su diseño, permite cambiarlo y al confirmar crea otro sin tocar el original', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    api.create.mockResolvedValue({ ...saved, id: 'nuevo' });
    fixture.componentRef.setInput('id', 'abc');
    fixture.componentRef.setInput('clone', true);
    await fixture.whenStable();
    expect(element().querySelector('h1')?.textContent).toContain('Clonar QR');
    expect(element().querySelector<HTMLInputElement>('input[type=text]')?.value).toBe('Copia de Web');
    expect(element().textContent).not.toContain('Borrar');

    type('textarea', 'https://example.com/otra');
    await fixture.whenStable();
    const submit = element().querySelector<HTMLButtonElement>('button[type=submit]');
    expect(submit?.textContent).toContain('Crear copia');
    submit?.click();
    await fixture.whenStable();

    expect(api.update).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledWith({
      name: 'Copia de Web',
      value: 'https://example.com/otra',
      design: saved.design,
    });
    expect(navigate).toHaveBeenCalledWith(['/qr', 'nuevo'], expect.objectContaining({ replaceUrl: true }));
  });

  it('borra el QR que se está editando tras confirmarlo y vuelve a la lista', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.componentRef.setInput('id', 'abc');
    await fixture.whenStable();
    const remove = [...element().querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Borrar');

    remove?.click();
    await fixture.whenStable();
    expect(api.remove).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    remove?.click();
    await fixture.whenStable();
    expect(api.remove).toHaveBeenCalledWith('abc');
    expect(navigate).toHaveBeenCalledWith(['/']);
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
