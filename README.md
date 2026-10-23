# Generador de QR

Web para crear códigos QR personalizados a partir de un enlace, guardarlos y descargarlos en PNG o SVG.

- Colores de los módulos, del fondo y de los ojos (las tres esquinas), con avisos si el contraste es bajo o el código
  está invertido.
- Forma de los módulos (cuadrados, redondeados o puntos) y de los ojos (cuadrados, redondeados o círculos).
- Zona de silencio (mínimo 4 módulos) y esquinas redondeadas.
- Borde opcional con color y grosor.
- Imagen opcional en el centro sobre un recuadro con color, margen interior y redondeo propios.
- Los QR se guardan en el servidor, así que se pueden volver a editar o descargar más adelante.

## Garantías de legibilidad

Igual que el QR de EMM:

- Corrección de errores alta (H), que recupera hasta un 30 % del código.
- Zona de silencio de al menos 4 módulos, como pide el estándar.
- La imagen del centro ocupa como mucho un 22 % del lado y va separada de los módulos por un margen de un módulo
  del color del fondo.

## Ponerlo en marcha con Docker

```bash
docker compose up -d --build
```

La web queda en <http://localhost:8080> (otro puerto con `QR_PORT=9000 docker compose up -d`). Los QR se guardan en
una base de datos SQLite dentro del volumen `qr-data`, que se conserva aunque pares los contenedores con
`docker compose down`. **No** uses `docker compose down -v`, que borra el volumen y con él los QR.

Copia de seguridad de la base de datos:

```bash
docker compose cp api:/data/qr.db ./qr-backup.db
```

## Desarrollo

Hace falta Node 24.

```bash
cd backend && npm install && npm run dev
```

```bash
cd frontend && npm install && npm start
```

La web queda en <http://localhost:4200> y reenvía `/api` al backend (puerto 3000). En desarrollo la base de datos está
en `backend/data/qr.db`.

Comprobaciones:

```bash
cd frontend && npm run lint && npm test -- --watch=false
```

```bash
cd backend && npm run lint && npm test
```

## Estructura

- `frontend/`: Angular 22 con signals. El QR se dibuja como SVG propio (`src/app/qr/render.ts`) con el paquete
  `qrcode`; la vista previa, las miniaturas y las descargas usan ese mismo SVG.
- `backend/`: API REST con Fastify y SQLite (`node:sqlite`), en TypeScript que Node 24 ejecuta directamente.
  - `GET /api/qrs`, `POST /api/qrs`, `GET|PUT|DELETE /api/qrs/:id`, `GET /api/health`.
- `docker-compose.yml`: nginx sirve la web y reenvía `/api` al contenedor de la API.
