# LINCE — Generador dinámico de formularios KYC

## Resumen (qué hace este proyecto)

Es un **onboarding KYC** donde el formulario **no está escrito en el HTML de Angular**.

El operador elige país, giro y volumen. El backend le pide a un motor de IA (reglas generativas) un **JSON de campos**. Angular lee ese JSON y monta **Smart Components** al vuelo (`text`, `file`, `radio`, `repeater`…).

Ejemplo: Venezuela + riesgo alto → la IA escribe *«Para este usuario pide foto del pasaporte»* y aparece el input de archivo. Si marcas PEP = sí, el JSON se **reescribe** y salen cargo, país y origen de fondos. España low no pide pasaporte.

No es una tienda ni una mesa de remesas: **genera el expediente según riesgo**.

**Stack:** Angular 21 (Signals + `OnPush` + SSE) · Node/Express · **Drizzle** · MySQL (XAMPP).

---

## Arquitectura hexagonal

El hexágono es el **motor de reglas KYC** (`generator.js`). No emite HTML. Emite JSON. Angular y MySQL son adaptadores: el formulario no existe quemado en plantillas.

```
     intake Angular          renderer + Smart Components
     (país, giro, volumen)   (adaptador UI: JSON → widgets)
              │                         ▲
              │  SSE generate / POST adapt
              ▼                         │
         ┌────┴─────────────────────────┴────┐
         │         DOMINIO LINCE             │
         │  resolveRisk · buildSchema        │
         │  thoughts + FieldRule JSON        │
         └────┬─────────────────────────┬────┘
              │                         │
     adaptador HTTP/SSE          adaptador persistencia
     server.js                   store.js → Drizzle o RAM
```

| Capa | Qué es | Archivos |
|---|---|---|
| **Dominio** | País + volumen + giro → banda de riesgo → lista de campos (`type`, `when`, `required`). Cero DOM, cero SQL. | `generator.js` (`buildSchema`, `stream`, `COUNTRIES`) |
| **Puerto de entrada** | “Genera reglas” / “adapta con estas respuestas” / “guarda expediente”. | `GET /api/kyc/generate` (SSE), `POST /api/kyc/adapt`, `POST /api/kyc/submit` |
| **Adaptador de entrada** | Express hace SSE. Angular `KycService` abre `EventSource` y el `Renderer` recorre `steps[].fields`. | `server.js`, `kyc.service.ts`, `renderer.ts`, `fields.ts` |
| **Puerto de salida** | “Persiste el schema / el submit”. | `saveSchema()`, `saveSubmission()` |
| **Adaptador de salida** | Drizzle (`form_schemas`, `submissions`) o arrays en memoria. | `store.js`, `db.js`, `schema.js` |

`fields.ts` no conoce Venezuela. Si el JSON pide `type: "file"` y `key: "passportPhoto"`, pinta `lince-file`. El dominio decide *qué* pedir; el adaptador UI decide *cómo* pintarlo.

---

## Arranque

### 1. Base de datos (Drizzle)

1. XAMPP → **MySQL → Start**.
2. Copia `.env.example` a `.env` si usas otra clave.

```bash
cd c:\xampp\htdocs\nivelDos\GeneradorKyc
npm run db:setup
```

Crea la base `lince` y hace `drizzle-kit push` de `form_schemas` y `submissions`.

`DATABASE_URL=mysql://root:@127.0.0.1:3306/lince`

### 2. Mesa KYC

```bash
npm start
```

| Proceso | Puerto | URL |
|---|---|---|
| API Node (HTTP + SSE) | `3201` | http://localhost:3201/api/health |
| Angular | `4220` | http://localhost:4220 |

```bash
npm run api
npm run desk
npm run db:push
```

El proxy manda `/api` de `:4220` a `:3201`. Si MySQL no está, el API sigue en memoria (`"store": "memory"`).

---

## Drizzle (tablas)

Fuente de verdad: `api/src/schema.js`. mysql2 solo en `setup-db.js` para `CREATE DATABASE`.

| Tabla Drizzle | Tabla MySQL | Qué guarda |
|---|---|---|
| `formSchemas` | `form_schemas` | JSON generado, prompt, rationale, país, riesgo |
| `submissions` | `submissions` | Payload del expediente enviado |

---

## Rutas

Angular **no tiene rutas de página** (`app.routes.ts` vacío). Una pantalla: intake + renderer + JSON.

### HTTP API (`:3201`)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/health` | Liveness + `store` (`drizzle`/`memory`) |
| `GET` | `/api/kyc/catalog` | Países y actividades |
| `GET` | `/api/kyc/recent` | Últimos schemas persistidos |
| `GET` | `/api/kyc/generate?country=&activity=&volumeUsd=&risk=` | **SSE.** Piensa en texto y emite el JSON |
| `POST` | `/api/kyc/adapt` | Reescribe el schema con las respuestas (PEP, doc) |
| `POST` | `/api/kyc/submit` | Guarda el expediente |

Ejemplo SSE:

```bash
curl -N "http://localhost:3201/api/kyc/generate?country=VE&activity=persona&volumeUsd=9000&risk=high"
```

Eventos: `think` → `json` (trozos) → `schema` → `end`.

---

## Flujo

1. Intake (país / giro / volumen / riesgo auto o forzado). Eso **no** es el formulario KYC.
2. `Pedir reglas a la IA` abre un `EventSource`.
3. `generator.js` calcula la banda (país + efectivo + volumen) y arma el JSON: identidad, domicilio, PEP, foto de pasaporte si VE/high, beneficiarios si empresa.
4. `Renderer` recorre `schema.steps[].fields` y pinta `lince-smart` (`@switch` de type). **No hay `<input name="pasaporte">` quemado.**
5. `when: { field, op, value }` oculta/muestra campos (cédula vs pasaporte).
6. Cambiar PEP dispara `POST /api/kyc/adapt` y el renderer se reconstruye.
7. Submit valida required visibles y persiste con Drizzle.

---

## Archivos

```
GeneradorKyc/
  drizzle.config.mjs
  api/src/schema.js          form_schemas + submissions
  api/src/server.js          Express
  api/src/generator.js       Motor JSON (la “IA”)
  api/src/store.js           Drizzle + fallback memoria
  api/src/setup-db.js        npm run db:setup
  api/src/db.js
  api/src/load-env.js
  src/app/app.ts             Intake
  src/app/kyc.service.ts     SSE + values signal
  src/app/renderer.ts        Recorre el JSON
  src/app/fields.ts          Smart components
  src/app/models.ts          FieldRule / FormSchema
```

---

## Demo

1. País **Venezuela**, volumen alto o riesgo **high** → aparece **foto del pasaporte**.
2. País **Perú**, riesgo **low** → formulario corto, sin selfie ni origen de fondos.
3. Actividad **Empresa** → repeater de beneficiarios finales.
4. PEP = **Sí** → el JSON de la derecha cambia y salen cargo / país PEP.
5. El panel derecho muestra el pensamiento de la IA y el JSON crudo.

---

## Cómo se construyó (paso a paso)

Backend **Node/Express**. ORM **Drizzle**. El HTML del KYC **no se escribe a mano**.

1. App Angular 21:

```bash
cd c:\xampp\htdocs\nivelDos
ng new lince --directory GeneradorKyc --routing --style=scss --ssr=false --skip-git --skip-tests --defaults
cd GeneradorKyc
npm install express cors mysql2 drizzle-orm concurrently wait-on
npm install -D drizzle-kit @angular/common  # HttpClient ya viene con @angular/common
```

2. **Dominio** primero: `api/src/generator.js` — países, actividades, `resolveRisk()`, `buildSchema()` (pasaporte si VE/high, PEP, repeater si empresa), `stream()` (eventos `think` / `json` / `schema`).

3. **Puerto de salida**: `store.js` (memoria + Drizzle).

4. **Adaptador DB**: `schema.js`, `db.js`, `drizzle.config.mjs`, `setup-db.js` (base `lince`).

5. **Adaptador HTTP**: `server.js` `:3201` — catalog, generate SSE, adapt, submit, recent.

6. **Adaptador UI (generative)**: `models.ts` (`FieldRule`) → `kyc.service.ts` (SSE + `values` signal + adapt al cambiar PEP) → `fields.ts` (smart components) → `renderer.ts` (`@for` del JSON) → `app.ts` (solo intake: país/giro/volumen). `proxy.conf.json` `:4220` → `:3201`.

7. `npm start` = API + `ng serve --port 4220`. El intake **no** es el formulario KYC; es el disparador del puerto `generate`.
