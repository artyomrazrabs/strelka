import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const configured = !SUPABASE_URL.startsWith('ВСТАВЬ') && !SUPABASE_KEY.startsWith('ВСТАВЬ');
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const SEL = '*, author:profiles!challenges_author_id_fkey(nick), opponent:profiles!challenges_opponent_id_fkey(nick)';

function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function sendLoginLink(email) {
  const redirect = location.origin + location.pathname;
  check(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } }));
}

export async function signOut() {
  await sb.auth.signOut();
}

export async function getProfile(id) {
  return check(await sb.from('profiles').select('*').eq('id', id).maybeSingle());
}

export async function createProfile(id, nick) {
  return check(await sb.from('profiles').insert({ id, nick }).select().single());
}

export async function updateProfile(id, patch) {
  return check(await sb.from('profiles').update(patch).eq('id', id).select().single());
}

export async function findByNick(nick) {
  return check(await sb.from('profiles').select('id, nick').eq('nick', nick).maybeSingle());
}

export async function myChallenges(uid) {
  return check(await sb.from('challenges').select(SEL)
    .or(`author_id.eq.${uid},opponent_id.eq.${uid}`)
    .order('created_at', { ascending: false }).limit(200));
}

export async function openChallenges(uid) {
  return check(await sb.from('challenges').select(SEL)
    .eq('target', 'open').eq('status', 'pending').is('opponent_id', null).neq('author_id', uid)
    .order('created_at', { ascending: false }).limit(100));
}

export async function getChallenge(id) {
  return check(await sb.from('challenges').select(SEL).eq('id', id).maybeSingle());
}

export async function createChallenge(row) {
  return check(await sb.from('challenges').insert(row).select().single());
}

export async function updateChallenge(id, patch) {
  return check(await sb.from('challenges').update(patch).eq('id', id).select(SEL).single());
}
