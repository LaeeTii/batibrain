import type { UserProfile, UserRole } from '../../domain/types';
import { getSupabaseClient } from './client';

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type ProfileInput = Pick<UserProfile, 'displayName' | 'firstName' | 'lastName'>;
export type AccountResult = { error: Error | null };

export interface AccountGateway {
  loadProfile(): Promise<{ profile: UserProfile | null; email: string; error: Error | null }>;
  updateProfile(input: ProfileInput, avatar: File | null): Promise<{ profile: UserProfile | null; error: Error | null }>;
  requestEmailChange(email: string): Promise<AccountResult>;
  updatePassword(password: string): Promise<AccountResult>;
}

export function validateAvatar(file: File): string | null {
  if (!AVATAR_TYPES.has(file.type)) return 'Choisissez une image JPEG, PNG, WebP ou GIF.';
  if (file.size > MAX_AVATAR_SIZE_BYTES) return 'L’image ne doit pas dépasser 5 Mio.';
  return null;
}

export const supabaseAccountGateway: AccountGateway = {
  async loadProfile() {
    try {
      const client = getSupabaseClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) return { profile: null, email: '', error: normalizeError(authError) };
      const { data, error } = await client
        .from('user_profiles')
        .select('user_id,display_name,first_name,last_name,avatar_storage_path,role')
        .eq('user_id', authData.user.id)
        .single();
      if (error || !data) return { profile: null, email: '', error: normalizeError(error) };

      const avatarUrl = data.avatar_storage_path
        ? (await client.storage.from('user-avatars').createSignedUrl(data.avatar_storage_path, 3600)).data?.signedUrl ?? null
        : null;
      return {
        email: authData.user.email ?? '',
        profile: mapProfile(data, avatarUrl),
        error: null,
      };
    } catch (error) {
      return { profile: null, email: '', error: normalizeError(error) };
    }
  },

  async updateProfile(input, avatar) {
    const client = getSupabaseClient();
    let uploadedPath: string | null = null;
    let previousPath: string | null = null;

    try {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) return { profile: null, error: normalizeError(userError) };
      const { data: current, error: currentError } = await client
        .from('user_profiles')
        .select('avatar_storage_path')
        .eq('user_id', userData.user.id)
        .single();
      if (currentError) return { profile: null, error: normalizeError(currentError) };
      previousPath = current.avatar_storage_path;

      if (avatar) {
        const validationError = validateAvatar(avatar);
        if (validationError) return { profile: null, error: new Error(validationError) };
        const extension = avatar.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'image';
        uploadedPath = `${userData.user.id}/avatar-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from('user-avatars').upload(uploadedPath, avatar);
        if (uploadError) return { profile: null, error: normalizeError(uploadError) };
      }

      const avatarPath = uploadedPath ?? previousPath;
      const { data, error } = await client.rpc('update_own_profile', {
        new_display_name: input.displayName,
        new_first_name: input.firstName,
        new_last_name: input.lastName,
        new_avatar_storage_path: avatarPath,
      });
      if (error || !data) {
        if (uploadedPath) await client.storage.from('user-avatars').remove([uploadedPath]);
        return { profile: null, error: normalizeError(error) };
      }

      if (uploadedPath && previousPath) await client.storage.from('user-avatars').remove([previousPath]);
      const signedUrl = avatarPath
        ? (await client.storage.from('user-avatars').createSignedUrl(avatarPath, 3600)).data?.signedUrl ?? null
        : null;
      return { profile: mapProfile(data, signedUrl), error: null };
    } catch (error) {
      if (uploadedPath) await client.storage.from('user-avatars').remove([uploadedPath]);
      return { profile: null, error: normalizeError(error) };
    }
  },

  async requestEmailChange(email) {
    const { error } = await getSupabaseClient().auth.updateUser(
      { email },
      { emailRedirectTo: window.location.origin },
    );
    return { error: error ? normalizeError(error) : null };
  },

  async updatePassword(password) {
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    return { error: error ? normalizeError(error) : null };
  },
};

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return null;
  const { data, error } = await client.from('user_profiles').select('role').eq('user_id', authData.user.id).single();
  return error ? null : data.role as UserRole;
}

function mapProfile(data: Record<string, unknown>, avatarUrl: string | null): UserProfile {
  return {
    userId: String(data.user_id),
    displayName: String(data.display_name),
    firstName: String(data.first_name),
    lastName: String(data.last_name),
    avatarStoragePath: data.avatar_storage_path ? String(data.avatar_storage_path) : null,
    avatarUrl,
    role: data.role as UserRole,
  };
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Le service de compte est indisponible.');
}
