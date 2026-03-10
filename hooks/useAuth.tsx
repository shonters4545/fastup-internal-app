'use client';

import { useState, useEffect, useContext, createContext, useCallback } from 'react';
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

  useEffect(() => {
    const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder');
    if (isPlaceholder) {
      setLoading(false);
      return;
    }

    const fetchUserProfile = async (user: User) => {
      console.log('[Auth] fetchUserProfile started for:', user.email, 'auth_id:', user.id);
      try {
        console.log('[Auth] About to query users table...');
        const res = await supabase
          .from('users')
          .select('id, role')
          .eq('auth_id', user.id)
          .single<{ id: string; role: string }>();

        console.log('[Auth] profile query result:', res.data, 'error:', res.error?.message ?? 'none', 'status:', res.status);

        if (!res.data) {
          console.warn('[Auth] No user profile found for auth_id:', user.id);
          setCurrentUser(null);
          setLoading(false);
          return;
        }
        setCurrentUser({
          id: res.data.id,
          authId: user.id,
          displayName: user.user_metadata?.full_name ?? null,
          email: user.email ?? null,
          photoURL: user.user_metadata?.avatar_url ?? null,
          role: (res.data.role as UserRole) ?? 'student',
        });
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    const initAuth = async () => {
      console.log('[Auth] initAuth started');
      try {
        // Use getSession first to ensure the client has a valid session token
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('[Auth] getSession result:', session?.user?.email ?? 'no session', sessionError?.message ?? 'no error');

        if (session?.user) {
          await fetchUserProfile(session.user);
        } else {
          setCurrentUser(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('[Auth] initAuth exception:', err);
        setCurrentUser(null);
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchUserProfile(session.user);
        } else {
          setCurrentUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
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
    await supabase.auth.signOut();
    setCurrentUser(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ currentUser, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
