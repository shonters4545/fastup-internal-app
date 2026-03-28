'use client';

import { useState, useEffect, useContext, createContext, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/types/database';

export interface AuthUser {
  id: string;
  authId: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());
  const currentUserRef = useRef<AuthUser | null>(null);

  // Only update currentUser if values actually changed (prevents unnecessary re-renders on token refresh)
  const updateCurrentUser = useCallback((newUser: AuthUser | null) => {
    const prev = currentUserRef.current;
    if (prev === newUser) return;
    if (prev && newUser && prev.id === newUser.id && prev.authId === newUser.authId && prev.role === newUser.role && prev.email === newUser.email && prev.displayName === newUser.displayName && prev.photoURL === newUser.photoURL) return;
    currentUserRef.current = newUser;
    setCurrentUser(newUser);
  }, []);

  useEffect(() => {
    const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder');
    if (isPlaceholder) {
      setLoading(false);
      return;
    }

    const fetchUserProfile = async (accessToken: string, user: User) => {
      console.log('[Auth] fetchUserProfile started for:', user.email, 'auth_id:', user.id);
      try {
        // Use direct fetch to bypass any supabase-js client issues
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?select=id,role&auth_id=eq.${user.id}`;
        console.log('[Auth] Fetching:', url);
        const response = await fetch(url, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
        console.log('[Auth] Fetch response status:', response.status);
        const rows = await response.json();
        console.log('[Auth] Fetch result:', rows);

        const profile = Array.isArray(rows) ? rows[0] : null;
        if (!profile) {
          // No profile found — try processing pending invite via API
          console.warn('[Auth] No user profile found, attempting invite processing for:', user.email);
          try {
            const inviteRes = await fetch('/api/auth/process-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                authId: user.id,
                email: user.email,
                displayName: user.user_metadata?.full_name ?? user.email,
                photoUrl: user.user_metadata?.avatar_url ?? null,
              }),
            });
            if (inviteRes.ok) {
              // Retry fetching profile after invite processing
              const retryRes = await fetch(url, {
                headers: {
                  'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/json',
                },
              });
              const retryRows = await retryRes.json();
              const retryProfile = Array.isArray(retryRows) ? retryRows[0] : null;
              if (retryProfile) {
                updateCurrentUser({
                  id: retryProfile.id,
                  authId: user.id,
                  displayName: user.user_metadata?.full_name ?? null,
                  email: user.email ?? null,
                  photoURL: user.user_metadata?.avatar_url ?? null,
                  role: (retryProfile.role as UserRole) ?? 'student',
                });
                setLoading(false);
                return;
              }
            }
          } catch (inviteErr) {
            console.error('[Auth] Invite processing failed:', inviteErr);
          }
          console.warn('[Auth] No user profile and no invite found for:', user.email);
          updateCurrentUser(null);
          setLoading(false);
          return;
        }
        updateCurrentUser({
          id: profile.id,
          authId: user.id,
          displayName: user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          photoURL: user.user_metadata?.avatar_url ?? null,
          role: (profile.role as UserRole) ?? 'student',
        });
      } catch (err) {
        console.error('Error fetching user profile:', err);
        updateCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Use onAuthStateChange as the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] onAuthStateChange event:', event, 'user:', session?.user?.email ?? 'none');
        if (session?.user && session.access_token) {
          await fetchUserProfile(session.access_token, session.user);
        } else {
          updateCurrentUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      console.error('Google sign-in error:', error);
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' });
    currentUserRef.current = null;
    setCurrentUser(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ currentUser, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
