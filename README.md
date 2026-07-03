FixYa — Proyecto web

Sitio de FixYa listo para desplegar en **Vercel** y conectar a **Supabase**. No necesitas instalar nada ni usar la terminal: es HTML, CSS y JavaScript puro.

## Qué incluye

- **Vista pública** (sin necesidad de registrarte): landing, simulador de solicitud, y el directorio de técnicos con sus trabajos anteriores.
- **Registro e inicio de sesión** con Supabase Auth (correo + contraseña), con dos roles disponibles al registrarse: **Cliente** y **Técnico**.
- **Vista de Cliente**: puede ver el directorio de técnicos y el portafolio de trabajos anteriores de cada uno.
- **Vista de Técnico**: panel con solicitudes urgentes (demo), calculadora de ganancias, y **"Mi Portafolio"** para subir fotos y descripciones de trabajos anteriores.
- **Vista de Administrador**: dashboard con métricas del negocio, salud del stack tecnológico y canales de adquisición (acceso no público — ver abajo cómo activarlo).

Antes de conectar Supabase, la app funciona igual en **modo demo**: puedes navegar todo, pero el registro no persiste datos reales y lo que un técnico "suba" a su portafolio solo se ve durante esa sesión (se explica con un aviso en pantalla).

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratis.
2. Crea un **New Project** (elige una contraseña de base de datos y guárdala).
3. Cuando el proyecto termine de crearse, ve a **SQL Editor** → **New query**.
4. Abre el archivo [`supabase/schema.sql`](./supabase/schema.sql) de este proyecto, copia todo su contenido, pégalo en el editor y presiona **Run**.
   5. Esto crea las tablas `profiles` y `portfolio_items`, las reglas de seguridad (Row Level Security), y el bucket de almacenamiento `portfolio` para las fotos.
5. Ve a **Project Settings → API**. Ahí vas a encontrar dos datos que necesitas:
   7. **Project URL**
   8. **anon public key**

## 2. Conectar la app a tu proyecto

1. Abre el archivo [`assets/js/config.js`](./assets/js/config.js).
2. Reemplaza estas dos líneas con tus propios datos del paso anterior:

```js
export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_ANON_KEY = 'TU-ANON-KEY-PUBLICA-AQUI';
```

3. Guarda el archivo. Eso es todo — no hay más configuración ni variables de entorno que crear. La clave `anon` está pensada para ser pública (viaja al navegador de cualquier visitante); lo que protege tus datos son las reglas de seguridad que ya vienen incluidas en `schema.sql`.

## 3. Desplegar en Vercel

**Opción A — Arrastrar y soltar (la más simple):**
1. Ve a [vercel.com](https://vercel.com) y crea una cuenta gratis.
2. En el dashboard, elige **Add New → Project**.
3. Si te lo permite, arrastra la carpeta completa de este proyecto (o sube un `.zip`).
4. Framework Preset: elige **Other** (es un sitio estático, no necesita build).
5. Presiona **Deploy**. En menos de un minuto tendrás una URL pública (`algo.vercel.app`).

**Opción B — Desde GitHub:**
1. Sube esta carpeta a un repositorio nuevo en GitHub.
2. En Vercel, elige **Add New → Project → Import Git Repository** y selecciona ese repositorio.
3. Framework Preset: **Other**. Deja todo lo demás por defecto.
4. Presiona **Deploy**.

Cualquiera de las dos opciones funciona igual de bien — no hay build, ni backend propio, ni variables de entorno que configurar en Vercel.

## 4. Crear tu cuenta de administrador

Por seguridad, el formulario de registro público **solo** permite crear cuentas de Cliente o Técnico — no hay opción de "Admin" ahí a propósito.

Para volverte administrador:
1. Regístrate normalmente en tu sitio ya desplegado (como Cliente o Técnico, no importa cuál).
2. En Supabase, ve a **Authentication → Users** y copia el UUID de tu usuario.
3. Ve a **SQL Editor** y corre:

```sql
update public.profiles set role = 'admin' where id = 'PEGA-AQUI-TU-UUID';
```

4. Cierra sesión y vuelve a iniciar sesión en el sitio — ahora entrarás directo al dashboard de administrador.

## Estructura del proyecto

```
fixya-app/
├── index.html                 ← página única (landing + login + los 3 dashboards)
├── vercel.json                ← configuración mínima de Vercel
├── assets/
│   ├── css/style.css          ← todos los estilos
│   └── js/
│       ├── config.js          ← aquí pegas tu URL y anon key de Supabase
│       ├── supabase-client.js ← inicializa el SDK de Supabase
│       ├── auth.js            ← registro, login, logout, sesión, recuperar contraseña
│       ├── chatbot.js         ← asistente de preguntas frecuentes
│       └── app.js             ← toda la lógica de la interfaz
└── supabase/
    └── schema.sql             ← esquema de base de datos, copiar y pegar en Supabase
```

## Qué está conectado a Supabase y qué sigue siendo demo

✅ **Conectado de verdad** (una vez que sigas los pasos de arriba):
- Registro e inicio de sesión, **y recuperación de contraseña** ("¿Olvidaste tu contraseña?" en el login)
- Roles (cliente / técnico / admin)
- Directorio de técnicos, con foto de perfil real, zona y especialidades que cada técnico configura
- Portafolio de trabajos anteriores (subir, ver, eliminar, con fotos)
- **Ventas reales**: cuando un cliente confirma una solicitud en el simulador, se guarda en la tabla `service_requests`, y el dashboard de Admin calcula el GMV, la comisión y las ventas por categoría a partir de esos datos reales.
- **"Tus solicitudes" (cliente)**: cada cliente ve su propio historial real de solicitudes confirmadas.
- **Panel de técnico real**: aceptar una solicitud urgente la asigna de verdad en la base de datos. Ganancias, servicios aceptados, solicitudes activas e historial se calculan a partir de datos reales.
- **Mi Perfil (técnico)**: cada técnico sube su foto, elige su zona y sus especialidades — se reflejan al instante en el directorio público.
- **Verificación de identidad**: el técnico sube una foto de su INE (o identificación oficial); el Admin la revisa y aprueba/rechaza desde su dashboard. El documento es **privado** — nunca es público, solo el propio técnico y un admin pueden verlo (bucket de Storage separado y sin acceso público).
- **Asistente de preguntas frecuentes** (botón flotante 💬 abajo a la derecha): responde por palabras clave. No es un modelo de IA generativo — ver la sección "Chatbot con IA real" más abajo.

🧪 **Todavía es contenido de ejemplo**:
- Calificación de técnicos (no hay sistema de reseñas todavía)
- Canales de adquisición del panel de Admin
- Las metas de CAC, retención y balance oferta/demanda (marcadas como "Meta" a propósito)

> **Nota:** vuelve a pegar `supabase/schema.sql` completo en el SQL Editor y dale **Run** otra vez — es seguro, no borra tus datos ni tus tablas existentes, solo agrega las columnas, tablas y políticas nuevas que faltaban (foto de perfil, especialidades, verificación de identidad, etc.).

## Si algo no aparece después de subir cambios a GitHub

Cuando agregues un **archivo nuevo** (por ejemplo, la vez que se agregó `assets/js/chatbot.js`), asegúrate de arrastrarlo también al subir a GitHub — no basta con reemplazar los archivos que ya existían. Para confirmar que un archivo sí está en tu repositorio: entra a tu repo en GitHub, abre la carpeta `assets/js/`, y verifica que el archivo aparezca en la lista. Si no está, arrástralo de nuevo (usando el mismo link de "uploading an existing file" que usaste antes) y dale Commit. Después, en el navegador, haz un refresco forzado (Cmd+Shift+R) para asegurarte de que no estás viendo una versión guardada en caché.

## Confirmación de correo al registrarse

Por defecto, Supabase le pide a cada persona confirmar su correo (con un link que le llega al email) antes de poder iniciar sesión por primera vez. Es una medida de seguridad, pero puede ser incómodo mientras estás probando la app.

Para desactivarlo:
1. En Supabase, ve a **Authentication → Sign In / Providers**.
2. Abre **Email**.
3. Apaga el switch **"Confirm email"**.
4. Guarda.

Puedes volver a activarlo antes de lanzar la app de verdad, para evitar cuentas falsas.

## Chatbot con IA real (opcional, siguiente nivel)

El asistente que viene incluido (`assets/js/chatbot.js`) es rápido, gratis, y no necesita ninguna configuración — pero solo responde preguntas que ya anticipaste en su lista de FAQ.

Si más adelante quieres que responda cualquier pregunta con un modelo de IA real (como Claude), la forma segura de hacerlo es:
1. Crear una **Supabase Edge Function** (una pequeña función que corre en el servidor de Supabase, no en el navegador).
2. Guardar tu clave de la API de Anthropic como un "secret" de esa función — nunca en el código del sitio.
3. Desde `chatbot.js`, en vez de buscar en `FAQ_KB`, hacer una llamada a esa Edge Function con la pregunta del usuario, y esa función es la que le habla a la API de Claude y regresa la respuesta.

Es un paso más de configuración (sí requiere usar la terminal o el editor de funciones de Supabase), pero mantiene tu clave de API completamente segura. Si quieres, se puede construir en una siguiente sesión.

## Cuentas de prueba

No hay cuentas de demostración con contraseña fija — cada quien crea la suya desde el botón **Crear cuenta**. Esto es intencional: así las contraseñas nunca quedan visibles en el código fuente del sitio.
