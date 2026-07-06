// ============================================================
// FixYa — Cliente de Supabase
// ============================================================
// Carga el SDK de Supabase directamente desde un CDN (esm.sh),
// sin necesidad de instalar nada ni usar un bundler. Esto funciona
// tal cual en Vercel como sitio estático.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const isSupabaseConfigured =
  !!SUPABASE_URL && !SUPABASE_URL.includes('TU-PROYECTO') &&
  !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('TU-ANON-KEY');

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    '[FixYa] Supabase no está configurado todavía. ' +
    'Edita assets/js/config.js con tu URL y anon key. ' +
    'Mientras tanto, la app funciona en modo demo con datos de ejemplo.'
  );
}
