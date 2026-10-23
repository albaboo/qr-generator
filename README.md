# Generador de QR

Web para crear códigos QR personalizados a partir de un enlace, guardarlos y volver a descargarlos o editarlos cuando
quieras, en PNG o SVG.

Está pensada para usarla una sola persona en su propio ordenador: no tiene cuentas ni contraseñas, y por defecto solo se
puede abrir desde ese ordenador (`localhost`).

## Qué se puede personalizar

- **Colores** de los módulos, del fondo y de los ojos (los tres cuadrados de las esquinas), o sin fondo (transparente).
  Avisa si el contraste es tan bajo que el código podría no leerse, o si está invertido (claro sobre oscuro).
- **Forma de los módulos:** cuadrados, redondeados, redondeados unidos, puntos o puntos unidos. **Forma de los ojos:**
  cuadrados, redondeados o círculos.
- **Zona de silencio** (el margen alrededor del código) y esquinas redondeadas.
- **Borde** opcional: continuo, doble, discontinuo o de puntos, con su color, su grosor y su redondeo por fuera y por
  dentro.
- **Imagen en el centro** (un logo, por ejemplo) sobre un recuadro con color o transparente, con margen interior y
  redondeo propios.
- **Descarga** en PNG (de 256 a 4096 píxeles) o en SVG, que se puede ampliar sin perder calidad.

## Garantías de legibilidad

Por mucho que se personalice, el código se sigue pudiendo escanear:

- Usa la corrección de errores más alta (nivel H), que recupera hasta un 30 % del código si una parte está tapada o
  dañada.
- La zona de silencio es de al menos 4 módulos, como pide el estándar.
- La imagen del centro ocupa como mucho un 22 % del lado, y alrededor de su recuadro queda un margen de un módulo sin
  módulos.

Aun así, conviene probar el QR con el móvil antes de imprimirlo, sobre todo con colores poco contrastados.

## Requisitos

- [Git](https://git-scm.com/) para descargar el proyecto.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine con Docker Compose) **abierto y en
  marcha**.

No hace falta instalar Node ni nada más: Docker se encarga de todo.

## Instalación y puesta en marcha

1. Descarga el proyecto y entra en su carpeta:

   ```bash
   git clone https://github.com/albaboo/qr-generator.git
   ```

   ```bash
   cd qr-generator
   ```

2. Construye y arranca la aplicación (la primera vez tarda un par de minutos):

   ```bash
   docker compose up -d --build
   ```

3. Abre <http://localhost:8080> en el navegador.

No hace falta repetir estos pasos cada vez: los contenedores vuelven a arrancar solos al abrir Docker, así que basta con
tenerlo abierto y entrar en la dirección. Si los paraste con `docker compose down`, arráncalos con
`docker compose up -d`.

## Cómo se usa

1. En **Mis QR** pulsa **Crear un QR** (o **Nuevo QR** si ya tienes alguno).
2. Ponle un **nombre** (para reconocerlo en la lista) y escribe el **enlace** o el texto que debe abrir.
3. Cambia los colores, la forma, el borde o la imagen del centro. La vista previa de la izquierda se actualiza al
   momento, y debajo aparecen los avisos si algo puede dificultar la lectura.
4. Pulsa **Guardar**. Desde la vista previa puedes elegir el formato y el tamaño y pulsar **Descargar**.

Desde la lista, o dentro de un QR guardado, puedes:

- **Editar:** cambiar lo que quieras y volver a guardar.
- **Clonar:** abre un formulario con una copia del QR (nombre, enlace y diseño) para que la cambies. Al pulsar **Crear
  copia** se guarda como un QR nuevo y el original no se toca. Es la forma más rápida de hacer otro con el mismo estilo.
- **Borrar:** pide confirmación y no se puede deshacer.
- **Descargar** otra vez, en el formato y el tamaño que necesites.

Si sales del editor con cambios sin guardar, la web te avisa antes.

## Parar, actualizar y desinstalar

Parar la aplicación (los QR guardados se conservan):

```bash
docker compose down
```

Actualizar a la última versión del repositorio:

```bash
git pull
```

```bash
docker compose up -d --build
```

Desinstalar **borrando también todos los QR guardados**:

```bash
docker compose down -v
```

> **Cuidado:** la opción `-v` borra el volumen `qr-data`, donde está la base de datos. Úsala solo si de verdad quieres
> perder los QR, y haz antes una copia de seguridad.

## Dónde se guardan los QR y cómo hacer una copia de seguridad

Los QR se guardan en una base de datos SQLite (`/data/qr.db`) dentro del volumen de Docker `qr-data`. Sobrevive a
`docker compose down`, a las actualizaciones y a los reinicios del ordenador.

Para hacer una copia, para un momento la API (así la base de datos queda completa en un solo archivo), copia el archivo
y vuelve a arrancarla:

```bash
docker compose stop api
```

```bash
docker compose cp api:/data/qr.db ./qr-backup.db
```

```bash
docker compose start api
```

Para restaurar una copia (sustituye todos los QR actuales por los de la copia):

```bash
docker compose stop api
```

```bash
docker compose cp ./qr-backup.db api:/data/qr.db
```

```bash
docker compose run --rm --no-deps --user root api chown node:node /data/qr.db
```

```bash
docker compose start api
```

El tercer paso devuelve el archivo al usuario de la API; sin él, los QR se ven pero no se pueden guardar ni borrar.

## Problemas frecuentes

- **`Cannot connect to the Docker daemon`:** Docker no está abierto. Ábrelo, espera a que termine de arrancar y repite
  el comando.
- **El puerto 8080 ya está en uso:** arranca la web en otro puerto, por ejemplo el 9000, y entra en
  <http://localhost:9000>:

  ```bash
  QR_PORT=9000 docker compose up -d
  ```

- **«No se han podido cargar los QR guardados»:** la API no está en marcha. Mira su estado y sus mensajes:

  ```bash
  docker compose ps
  ```

  ```bash
  docker compose logs api
  ```

## Desarrollo

Para cambiar el código sin Docker hace falta [Node 24](https://nodejs.org/). Abre dos terminales, una para la API:

```bash
cd backend && npm install && npm run dev
```

Y otra para la web:

```bash
cd frontend && npm install && npm start
```

La web queda en <http://localhost:4200>, se recarga sola al guardar cambios y reenvía `/api` a la API (puerto 3000). En
desarrollo la base de datos está en `backend/data/qr.db`, aparte de la de Docker.

La API admite estas variables de entorno: `PORT` (por defecto 3000), `HOST` (por defecto `127.0.0.1`) y `DATABASE_PATH`
(por defecto `data/qr.db`).

Comprobaciones (lint, tipos y tests) antes de subir cambios:

```bash
cd frontend && npm run lint && npm test -- --watch=false
```

```bash
cd backend && npm run lint && npm test
```

## Estructura

- `frontend/`: Angular 22 con signals.
  - `src/app/qr/`: el modelo del diseño (`design.ts`), el dibujo del QR como SVG (`render.ts`, con el paquete `qrcode`),
    los avisos de contraste (`contrast.ts`) y las descargas (`download.ts`). La vista previa, las miniaturas y las
    descargas usan el mismo SVG, así que lo que se ve es lo que se descarga.
  - `src/app/pages/`: la lista de QR y el editor (crear, editar y clonar).
- `backend/`: API REST con Fastify y SQLite (`node:sqlite`), en TypeScript que Node 24 ejecuta directamente. Valida
  cada diseño con un esquema estricto antes de guardarlo.
  - `GET /api/qrs`: lista de QR, del último modificado al primero.
  - `POST /api/qrs`: crea uno.
  - `GET|PUT|DELETE /api/qrs/:id`: lee, modifica o borra uno.
  - `GET /api/health`: comprobación de que la API está en marcha.
- `docker-compose.yml`: dos contenedores, `web` (nginx, que sirve la web y reenvía `/api`) y `api`, con el volumen
  `qr-data` para la base de datos.
