# Taller de imágenes

Panel interno para generar y editar imágenes con los modelos del market de Kie AI
(kie.ai). Next.js (App Router) + Tailwind, la misma base que monitor-x.

## Puesta en marcha

```bash
npm install
cp .env.ejemplo .env.local     # y completá los valores
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

La key va en `.env.local`, en la variable `KIE_API_KEY`. Se saca del dashboard de
[kie.ai](https://kie.ai). Nunca llega al navegador: todas las llamadas salen desde las
API routes.

Para correrlo en modo producción: `npm run build && npm start`. Anda igual en Vercel,
ver [Supabase](#dónde-se-guardan-las-imágenes-supabase).

## Qué hace

- **Generar**: elegís un modelo, escribís el prompt y (según el modelo) tamaño y formato.
  El panel esconde los controles que ese modelo no soporta.
- **Editar**: subís hasta 6 imágenes de referencia (arrastrando o eligiéndolas) y pedís
  el cambio. Algunos modelos (Recraft, Topaz, el segment-map de Grok) solo sirven para
  editar, así que no aparecen en el selector cuando el modo es "Generar" — y al revés,
  los que solo generan no aparecen en "Editar".
- **Estilos**: chips que agregan una coletilla al prompt. Están en `lib/config.js`, en
  `ESTILOS`, y se editan sin tocar nada más.
- **Historial**: todo lo generado queda en Supabase y aparece al recargar. Cada imagen
  guarda prompt, modelo, tamaño, origen y fecha.
- **Medidor**: cuenta las imágenes del día y los créditos de Kie gastados en la sesión
  contra un presupuesto (en créditos) que ponés vos. La barra se llena y pasa a rojo
  cuando lo superás. Si `/api/kie/creditos` responde, también muestra el saldo real
  de la cuenta.
- **Visor**: clic en una imagen para verla grande con su ficha al costado.
  Flechas para moverte, `Esc` para salir.
- Atajo: `Ctrl + Enter` (o `Cmd + Enter`) dentro del prompt dispara la generación.

## Dónde queda cada cosa

```
app/api/generar        crea una tarea en Kie para generar desde cero
app/api/editar          sube las referencias y crea una tarea en Kie para editar
app/api/tarea/[taskId] pollea una tarea de Kie; cuando termina, baja y guarda la imagen
app/api/kie/creditos   saldo de la cuenta de Kie, para el medidor
app/api/imagen          sirve las imágenes descargándolas del bucket privado
app/api/estado          si hay KIE_API_KEY configurada, para la franja de arriba
lib/kie.js               cliente del market de Kie: crear tarea, ver estado, saldo, subir referencias
lib/proveedores.js       registro declarativo de los modelos (ver más abajo)
lib/almacen.js           subida a Supabase Storage, la tabla del historial, borrado
lib/supabase.js          cliente de Supabase (service role, solo servidor)
lib/config.js             estilos, tamaños, calidades y formatos del panel
```

## Dónde se guardan las imágenes (Supabase)

Las imágenes no se escriben en disco (Vercel tiene el filesystem de solo lectura): se
suben a Supabase Storage y el historial vive en una tabla. Hace falta un proyecto de
Supabase con:

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
  | `referencias`    | `int4` (nullable)        |

  `lib/almacen.js` inserta una fila por imagen generada y borra la fila (+ el objeto del
  bucket) al borrar. No hace falta RLS abierta al público: todo el acceso pasa por la
  service role key desde las API routes, nunca desde el navegador.

  `modelo` guarda el `model` crudo de Kie (ej. `flux-2/pro-text-to-image`), `calidad`
  guarda la resolución pedida (ej. `1K`) ya que Kie no tiene el concepto de calidad
  baja/media/alta, y `tamano` guarda el tamaño equivalente al `aspect_ratio` que devolvió
  la tarea.

  **Historial viejo:** las imágenes generadas cuando el panel todavía usaba OpenAI
  siguen en la tabla con el `modelo` de esa época (ej. `gpt-image-1-mini`) — se ven y se
  borran igual, la Galería y `borrarImagen` no distinguen de dónde salió cada fila. Lo
  único que cambia es "Reusar": si el modelo de esa imagen ya no existe en el registro,
  reusa el prompt y el tamaño pero no cambia el modelo elegido.

## Variables de entorno

Tres en total, todas en `.env.local` (ver `.env.ejemplo`):

- `SUPABASE_URL` — URL del proyecto de Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` — service role key de Supabase (acceso total, solo servidor).
- `KIE_API_KEY` — key de Kie AI (kie.ai), el único proveedor de imágenes.

## Modelos y flujo de tareas

### Cómo agregar un modelo

Todo pasa por `lib/proveedores.js`, en el array `MODELOS_KIE`. Cada entrada es un objeto
con:

- `id`: el id interno que usa el panel (ej. `"kie-flux2-pro"`), prefijo `kie-` obligatorio.
- `nombre`: lo que se ve en el selector.
- `grupo`: agrupa el selector por uso, no por proveedor — `"Realista"`, `"Edición"`,
  `"Económicos"` o `"Retoque"`.
- `nota`: una línea que se muestra debajo del selector cuando ese modelo está elegido.
- `creditos`: costo estimado por imagen, en créditos de Kie. **Es una estimación** — casi
  ningún modelo publica un número exacto, así que conviene revisar el saldo real después
  de las primeras tareas y ajustar este número.
- `controles`: qué controles del panel aplican a este modelo (`calidad`, `cantidad`,
  `formato`, `fondo`; y `formatosPermitidos` si `formato` es `true` pero el modelo no
  soporta los tres formatos). Los controles no declarados quedan ocultos.
- `generar` / `editar`: solo se declara el que el modelo soporta (algunos, como Recraft o
  Topaz, exigen una imagen de entrada y por eso solo tienen `editar`). Cada uno lleva el
  `model` exacto que espera Kie, el nombre del campo de `input` que lleva la(s)
  referencia(s) (`campoImagenes`, documentación nomás), y `armarInput(prompt, tamano,
  urls, formato, calidad)`, que mapea nuestros controles a los parámetros de Kie (por
  ejemplo, nuestro tamaño `"1024x1024"` a su `aspect_ratio` `"1:1"`).

Agregar un modelo nuevo es agregar una entrada acá. Ninguna ruta necesita tocarse.

### Por qué es por tareas, no sincrónico

Kie no devuelve la imagen en la respuesta de `createTask`: solo un `taskId`, y la imagen
se genera en segundo plano del lado de ellos. Por eso:

1. `/api/generar` o `/api/editar` crean la tarea y responden enseguida con
   `{ taskId, proveedor: "kie" }` (202), sin esperar el resultado.
2. El frontend (`app/page.js`) pollea `GET /api/tarea/[taskId]` cada 2 segundos, hasta
   90 intentos (3 minutos), mostrando la placa de "Revelando…" mientras tanto. La mayoría
   de las tareas termina en menos de 30 segundos.
3. Cuando la tarea termina, esa misma ruta descarga la imagen desde la URL de resultado
   de Kie, la sube a Supabase Storage e inserta la fila — recién ahí el frontend la ve.
   La URL de Kie **nunca** se guarda: expira, así que hay que bajar el archivo apenas
   está listo.
4. Si se agotan los intentos, el panel avisa con el último estado visto y un botón
   "Reintentar" para volver a consultar el mismo `taskId` sin perder la tarea (puede
   seguir corriendo del lado de Kie igual).

Cada tarea de Kie genera una sola imagen — ninguno de estos modelos tiene un parámetro
de cantidad — así que el control de Cantidad se oculta y queda fijo en 1.

## Acceso con contraseña

Este panel hoy **no tiene login**: cualquiera que llegue a la URL puede generar y gastar
créditos. Si lo compartís fuera de tu red o lo subís a un dominio público, ponele algo
delante (una contraseña vía middleware, un proxy con auth, etc.) antes.

## Notas de costo

- El medidor de créditos suma lo que realmente devuelve Kie al terminar cada tarea
  (`creditsConsumed`), no una estimación — pero solo de la sesión actual: ese número no
  se guarda en la tabla, así que se pierde al recargar la página.
- Mirá `nota` en cada entrada de `lib/proveedores.js` para saber cuál conviene para
  cada caso (el más barato para probar prompts, cuál sirve para retocar, etc.).
- El saldo real de la cuenta se consulta en `/api/kie/creditos` y aparece al lado del
  contador de la sesión en el medidor.

## Pendientes

- El presupuesto diario hoy solo avisa. Se le puede hacer que bloquee el botón al llegar al tope.
- Sin login (ver arriba).
