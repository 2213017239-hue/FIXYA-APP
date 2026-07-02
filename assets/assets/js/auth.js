// ============================================================
// FixYa — Autenticación
// ============================================================
import { supabase, isSupabaseConfigured } from './supabase-client.js';

let currentUser = null;
let currentProfile = null;
let initialized = false;

function notify() {
  document.dispatchEvent(new CustomEvent('fixya:auth-change', {
    detail: { user: currentUser, profile: currentProfile }
  }));
}

export function getSession() {
  return { user: currentUser, profile: currentProfile };
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('[FixYa] Error al leer el perfil:', error.message);
    return null;
  }
  return data;
}

// role: 'cliente' | 'tecnico'
export async function signUp({ email, password, name, role }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado. Edita assets/js/config.js primero.');
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, role } }
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado. Edita assets/js/config.js primero.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (isSupabaseConfigured) await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  notify();
}

export async function initAuth() {
  if (initialized) return;
  initialized = true;

  if (!isSupabaseConfigured) {
    notify();
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    currentProfile = await fetchProfile(session.user.id);
  }
  notify();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      currentUser = session.user;
      currentProfile = await fetchProfile(session.user.id);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    notify();
  });
}
