import { fileName } from './download';

describe('fileName', () => {
  it('quita tildes y símbolos', () => {
    expect(fileName('Menú de la Peña · 2026', 'png')).toBe('menu-de-la-pena-2026.png');
  });

  it('usa «qr» si el nombre se queda vacío', () => {
    expect(fileName('¡¿?!', 'svg')).toBe('qr.svg');
  });
});
