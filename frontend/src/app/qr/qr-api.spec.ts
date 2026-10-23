import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { defaultDesign } from './design';
import { QrApi } from './qr-api';

describe('QrApi', () => {
  let api: QrApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(QrApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los QR completando los diseños antiguos', async () => {
    const list = api.list();
    http.expectOne('/api/qrs').flush([
      {
        id: 'a',
        name: 'Viejo',
        value: 'https://a.es',
        design: { foreground: '#ff0000' },
        createdAt: '',
        updatedAt: '',
      },
    ]);
    const [qr] = await list;
    expect(qr.design.foreground).toBe('#ff0000');
    expect(qr.design.border).toEqual(defaultDesign().border);
  });

  it('crea, actualiza y borra', async () => {
    const input = { name: 'Web', value: 'https://a.es', design: defaultDesign() };
    const saved = { ...input, id: 'b/c', createdAt: '', updatedAt: '' };

    const created = api.create(input);
    const post = http.expectOne({ method: 'POST', url: '/api/qrs' });
    expect(post.request.body).toEqual(input);
    post.flush(saved);
    expect((await created).id).toBe('b/c');

    const updated = api.update('b/c', input);
    http.expectOne({ method: 'PUT', url: '/api/qrs/b%2Fc' }).flush(saved);
    await updated;

    const removed = api.remove('b/c');
    http.expectOne({ method: 'DELETE', url: '/api/qrs/b%2Fc' }).flush(null, { status: 204, statusText: 'No Content' });
    await removed;
  });
});
