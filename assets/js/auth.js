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
export async function signUp({ email, password, name, phone, role }) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado. Edita assets/js/config.js primero.');
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, phone, role } }
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

// Envía un correo con un link para restablecer la contraseña.
export async function sendPasswordReset(email) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado. Edita assets/js/config.js primero.');
  }
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// Se usa después de que la persona entra desde el link del correo de recuperación.
export async function updatePassword(newPassword) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase no está configurado. Edita assets/js/config.js primero.');
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function initAuth() {
  if (initialized) return;
  initialized = true;

  if (!isSupabaseConfigured) {
    notify();
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      currentProfile = await fetchProfile(session.user.id);
    }
  } catch (err) {
    console.error('[FixYa] Error en initAuth getSession:', err);
  } finally {
    notify();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      currentProfile = await fetchProfile(session.user.id);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    if (event === 'PASSWORD_RECOVERY') {
      document.dispatchEvent(new CustomEvent('fixya:password-recovery'));
    }
    notify();
  });
}
