# Taller de imágenes

Panel interno para generar y editar imágenes con la API de OpenAI.
Next.js (App Router) + Tailwind, la misma base que monitor-x.

## Puesta en marcha

```bash
npm install
cp .env.ejemplo .env.local     # y completá las cuatro variables
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). Te va a pedir la contraseña
de acceso antes de dejarte entrar (ver [Acceso con contraseña](#acceso-con-contraseña)).

La key de OpenAI va en `.env.local`, en la variable `OPENAI_API_KEY`. La sacás de
[platform.openai.com/api-keys](https://platform.openai.com/api-keys).
Nunca llega al navegador: todas las llamadas salen desde las API routes.

Para correrlo en modo producción: `npm run build && npm start`. Anda igual en Vercel,
ver [Supabase](#dónde-se-guardan-las-imágenes-supabase).

## Qué hace

- **Generar**: prompt, modelo, calidad, tamaño, cantidad (1 a 4), formato y fondo transparente.
- **Editar**: subís hasta 6 imágenes de referencia (arrastrando o eligiéndolas) y pedís el cambio.
- **Estilos**: chips que agregan una coletilla al prompt. Están en `lib/config.js`, en `ESTILOS`,
  y se editan sin tocar nada más.
- **Historial**: todo lo generado queda en Supabase y aparece al recargar. Cada imagen guarda
  prompt, modelo, calidad, tamaño y fecha.
- **Medidor de gasto**: cuenta las imágenes del día y estima el gasto contra un presupuesto
  diario que ponés vos. La barra se llena y pasa a rojo cuando lo superás.
- **Visor**: clic en una imagen para verla grande con su ficha al costado.
  Flechas para moverte, `Esc` para salir.
- Atajo: `Ctrl + Enter` (o `Cmd + Enter`) dentro del prompt dispara la generación.

## Dónde queda cada cosa

```
app/api/generar    llamada a /v1/images/generations
app/api/editar     llamada a /v1/images/edits (multipart con las referencias)
app/api/imagen     sirve las imágenes descargándolas del bucket privado
app/api/entrar     valida la contraseña y setea la cookie de sesión
app/entrar         pantalla de acceso
middleware.js       puerta con contraseña: corta el paso si no hay cookie válida
lib/openai.js       llamadas a OpenAI, subida a Supabase Storage, historial
lib/supabase.js     cliente de Supabase (service role, solo servidor)
lib/config.js       precios, estilos, tamaños y calidades
```

## Dónde se guardan las imágenes (Supabase)

Las imágenes ya no se escriben en disco (Vercel tiene el filesystem de solo lectura):
se suben a Supabase Storage y el historial vive en una tabla. Hace falta un proyecto
de Supabase con:

- **Bucket privado `imagenes`**: guarda los binarios (`archivo.png/jpg/webp`). Como es
  privado, `app/api/imagen/[archivo]/route.js` es el único camino para verlas: descarga
  el objeto con la service role key y lo sirve con el Content-Type correcto.
- **Tabla `imagenes`**, con estas columnas:

  | columna          | tipo                     |
  |------------------|--------------------------|
  | `id`             | `text` (primary key)     |
  | `archivo`        | `text`                   |
  | `fecha`          | `timestamptz`            |
  | `prompt`         | `text`                   |
  | `modelo`         | `text`                   |
  | `calidad`        | `text`                   |
  | `tamano`         | `text`                   |
  | `origen`         | `text`                   |
  | `prompt_revisado`| `text` (nullable)        |

  `lib/openai.js` inserta una fila por imagen generada y borra la fila (+ el objeto del
  bucket) al borrar. No hace falta RLS abierta al público: todo el acceso pasa por la
  service role key desde las API routes, nunca desde el navegador.

## Variables de entorno

Cuatro en total, todas en `.env.local` (ver `.env.ejemplo`):

- `OPENAI_API_KEY` — key de OpenAI, para generar/editar imágenes.
- `SUPABASE_URL` — URL del proyecto de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — service role key de Supabase (acceso total, solo servidor).
- `CLAVE_ACCESO` — la contraseña del panel.

## Acceso con contraseña

Todo el sitio queda atrás de `middleware.js`, salvo `/entrar`, `/api/entrar` y los
assets de `_next`. Si no hay una cookie `sesion` válida, redirige a `/entrar`.

La cookie válida es el HMAC-SHA256 de la cadena `"ok"` usando `CLAVE_ACCESO` como clave,
en hexadecimal. `app/api/entrar/route.js` la calcula y la setea (`httpOnly`, `sameSite: lax`,
30 días) cuando la contraseña coincide; `middleware.js` la recalcula con Web Crypto en
cada pedido y compara. No hay usuarios ni tabla de sesiones: es una sola contraseña
compartida para todo el que use el panel.

## Sobre el medidor de gasto

Es un **estimado**, no la factura. Los precios están en `PRECIOS`, arriba de `lib/config.js`,
y se calculan sobre la imagen de salida; los tokens de texto del prompt se facturan aparte,
así que el número real de OpenAI siempre da un poco más alto. El gasto de verdad lo mirás en
[platform.openai.com/usage](https://platform.openai.com/usage).

Si OpenAI cambia la tabla de precios, editás ese objeto y listo.

## Notas de costo

- `gpt-image-1-mini` en calidad baja es lo más barato para probar prompts.
- Subí a calidad alta recién cuando el prompt ya esté afinado.
- `gpt-image-1` se discontinúa en octubre de 2026: no lo uses para nada nuevo.
- El selector de modelos se llena solo con los modelos de imagen habilitados en tu cuenta.
  Si esa consulta falla, quedan los cuatro por defecto de `MODELOS_BASE`.

## Pendientes

- El presupuesto diario hoy solo avisa. Se le puede hacer que bloquee el botón al llegar al tope.
