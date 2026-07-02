# FixYa — Proyecto web

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
   - Esto crea las tablas `profiles` y `portfolio_items`, las reglas de seguridad (Row Level Security), y el bucket de almacenamiento `portfolio` para las fotos.
5. Ve a **Project Settings → API**. Ahí vas a encontrar dos datos que necesitas:
   - **Project URL**
   - **anon public key**

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
│       ├── auth.js            ← registro, login, logout, sesión
│       └── app.js             ← toda la lógica de la interfaz
└── supabase/
    └── schema.sql             ← esquema de base de datos, copiar y pegar en Supabase
```

## Qué está conectado a Supabase y qué sigue siendo demo

✅ **Conectado de verdad** (una vez que sigas los pasos de arriba):
- Registro e inicio de sesión
- Roles (cliente / técnico / admin)
- Directorio de técnicos
- Portafolio de trabajos anteriores (subir, ver, eliminar, con fotos)
- **Ventas reales**: cuando un cliente confirma una solicitud en el simulador, se guarda en la tabla `service_requests`, y el dashboard de Admin calcula el GMV, la comisión y las ventas por categoría a partir de esos datos reales — arranca en $0 y crece solo conforme lleguen confirmaciones de verdad.

🧪 **Todavía es contenido de ejemplo** (para que puedas extenderlo tú):
- Lista de "solicitudes urgentes" del técnico
- Historial de servicios y ganancias del panel de técnico
- Salud del stack tecnológico y canales de adquisición del panel de Admin
- Las metas de CAC, retención y balance oferta/demanda (estas están marcadas como "Meta" a propósito — son objetivos de negocio, no mediciones en vivo)

> **Nota:** si ya habías corrido `schema.sql` antes de esta versión, vuelve a pegar el archivo completo en el SQL Editor y dale **Run** otra vez — es seguro, no borra tus datos ni tus tablas existentes, solo agrega la tabla nueva `service_requests` que faltaba.

## Cuentas de prueba

No hay cuentas de demostración con contraseña fija — cada quien crea la suya desde el botón **Crear cuenta**. Esto es intencional: así las contraseñas nunca quedan visibles en el código fuente del sitio.
