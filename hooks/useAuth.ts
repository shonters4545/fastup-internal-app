'use client';

import { useState, useEffect } from 'react';
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

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Skip Supabase calls if not configured (local UI preview mode)
    const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder');
    if (isPlaceholder) {
      setLoading(false);
      return;
    }

    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await fetchUserProfile(user);
        } else {
          setCurrentUser(null);
          setLoading(false);
        }
      } catch {
        setCurrentUser(null);
        setLoading(false);
      }
    };

    const fetchUserProfile = async (user: User) => {
      const { data: profile } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_id', user.id)
        .single();

      setCurrentUser({
        id: profile?.id ?? '',
        authId: user.id,
        displayName: user.user_metadata?.full_name ?? null,
        email: user.email ?? null,
        photoURL: user.user_metadata?.avatar_url ?? null,
        role: (profile?.role as UserRole) ?? 'student',
      });
      setLoading(false);
    };

    getUser();

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
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      console.error('Google sign-in error:', error);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return { currentUser, loading, signInWithGoogle, signOut };
};
