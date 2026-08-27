# Taller de imágenes

Panel interno para generar y editar imágenes con la API de OpenAI y con los modelos
del market de Kie AI (kie.ai). Next.js (App Router) + Tailwind, la misma base que monitor-x.

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

- **Generar**: prompt, modelo, calidad, tamaño, cantidad (1 a 4), formato y fondo transparente
  con OpenAI. Con un modelo de Kie el panel esconde los controles que ese modelo no soporta
  (ver [Kie AI: modelos y flujo de tareas](#kie-ai-modelos-y-flujo-de-tareas)).
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
app/api/generar        llamada a OpenAI (/v1/images/generations) o crea una tarea en Kie
app/api/editar         llamada a OpenAI (/v1/images/edits) o crea una tarea en Kie
app/api/tarea/[taskId] pollea una tarea de Kie; cuando termina, baja y guarda la imagen
app/api/kie/creditos   saldo de la cuenta de Kie, para el medidor
app/api/imagen         sirve las imágenes descargándolas del bucket privado
app/api/entrar         valida la contraseña y setea la cookie de sesión
app/entrar              pantalla de acceso
middleware.js           puerta con contraseña: corta el paso si no hay cookie válida
lib/openai.js           llamadas a OpenAI, subida a Supabase Storage, historial
lib/kie.js              cliente del market de Kie: crear tarea, ver estado, saldo, subir referencias
lib/proveedores.js      registro declarativo de los modelos de Kie (ver más abajo)
lib/supabase.js         cliente de Supabase (service role, solo servidor)
lib/config.js           precios de OpenAI, estilos, tamaños y calidades
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

  Las imágenes de Kie usan la misma tabla, sin columnas nuevas: `modelo` guarda el
  `model` crudo de Kie (ej. `flux-2/pro-text-to-image`), `calidad` guarda la resolución
  pedida (ej. `1K`) ya que Kie no tiene el concepto de calidad baja/media/alta, y
  `tamano` guarda el tamaño equivalente al `aspect_ratio` que devolvió la tarea.

## Variables de entorno

Cinco en total, todas en `.env.local` (ver `.env.ejemplo`):

- `OPENAI_API_KEY` — key de OpenAI, para generar/editar imágenes.
- `SUPABASE_URL` — URL del proyecto de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — service role key de Supabase (acceso total, solo servidor).
- `CLAVE_ACCESO` — la contraseña del panel.
- `KIE_API_KEY` — key de Kie AI (kie.ai), para los modelos del market (Flux-2 Pro, Nano Banana 2).

## Kie AI: modelos y flujo de tareas

Además de OpenAI, el panel puede generar/editar con modelos del market de Kie AI. El
selector de modelo los agrupa en dos `<optgroup>` — "OpenAI" (la lista de siempre, viene
de `/api/modelos`) y "Kie AI" (viene de un registro fijo en el código, no de una API).

### Cómo agregar un modelo de Kie

Todo pasa por `lib/proveedores.js`, en el array `MODELOS_KIE`. Cada entrada es un objeto
con:

- `id`: el id interno que usa el panel (ej. `"kie-flux2-pro"`), prefijo `kie-` obligatorio.
- `nombre`: lo que se ve en el selector.
- `creditos`: costo estimado por imagen, en créditos de Kie. **Es una estimación** — Kie
  no publica un número exacto por modelo, así que conviene mirar el saldo real después de
  las primeras tareas y ajustar este número.
- `controles`: qué controles del panel aplican a este modelo (`calidad`, `cantidad`,
  `formato`, `fondo`; y `formatosPermitidos` si `formato` es `true` pero el modelo no
  soporta los tres formatos). Los controles no declarados quedan ocultos.
- `generar` / `editar`: cada uno con el `model` exacto que espera Kie, el nombre del campo
  de `input` que lleva las URLs de referencia (`campoImagenes`, o `null` si ese modo no usa
  referencias), y `armarInput(prompt, tamano, urls, formato)`, que mapea nuestros controles
  a los parámetros de Kie (por ejemplo, nuestro tamaño `"1024x1024"` a su `aspect_ratio`
  `"1:1"`).

Agregar un modelo nuevo es agregar una entrada acá. Ninguna ruta necesita tocarse.

### OpenAI (síncrono) vs. Kie (por tareas)

Con OpenAI, `/api/generar` y `/api/editar` llaman a la API, esperan la respuesta con las
imágenes en base64, las suben a Supabase y devuelven la ficha ya lista. Todo en el mismo
pedido.

Kie no funciona así: `createTask` solo devuelve un `taskId`, y la imagen se genera en
segundo plano del lado de ellos. Por eso, cuando el modelo elegido es de Kie:

1. `/api/generar` o `/api/editar` crean la tarea y responden enseguida con
   `{ taskId, proveedor: "kie" }` (202), sin esperar el resultado.
2. El frontend (`app/page.js`) pollea `GET /api/tarea/[taskId]` cada 3 segundos, hasta
   100 intentos (5 minutos), mostrando la placa de "Revelando…" mientras tanto.
3. Cuando la tarea termina, esa misma ruta descarga la imagen desde la URL de resultado
   de Kie, la sube a Supabase Storage e inserta la fila — recién ahí el frontend la ve.
   La URL de Kie **nunca** se guarda: expira, así que hay que bajar el archivo apenas
   está listo.
4. Si se agotan los intentos, el panel avisa con el `taskId` a la vista para poder
   revisarlo a mano después (Kie puede seguir procesando la tarea igual).

Cada tarea de Kie genera una sola imagen — ninguno de estos modelos tiene un parámetro
de cantidad — así que el control de Cantidad se oculta y queda fijo en 1 cuando el
modelo elegido es de Kie.

### Medidor con Kie

El medidor de gasto sigue estimando en **dólares** para OpenAI, como siempre. Cuando se
usó algún modelo de Kie en la sesión, aparece una ficha aparte con los **créditos**
consumidos (sumados de `creditsConsumed`, que devuelve Kie al terminar cada tarea) y,
si `/api/kie/creditos` responde, el saldo restante de la cuenta. Las dos unidades nunca
se mezclan en un mismo número.

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
