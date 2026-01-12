import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type EventName = 
  // Signup funnel
  | 'auth_page_view'
  | 'signup_started'
  | 'signup_completed'
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  // Partner connection
  | 'invitation_code_generated'
  | 'invitation_code_shared'
  | 'invitation_code_entered'
  | 'couple_formed'
  // Activation & engagement
  | 'first_activity_logged'
  | 'activity_logged'
  | 'stats_viewed'
  | 'return_visit';

export function useAnalytics() {
  const track = useCallback(async (
    eventName: EventName, 
    eventData: Record<string, string | number | boolean | null> = {}
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Only track authenticated users
      
      await supabase.from('user_events').insert([{
        user_id: user.id,
        event_name: eventName,
        event_data: eventData as Json,
      }]);
    } catch (error) {
      // Silent fail - analytics should never break the app
      console.error('Analytics error:', error);
    }
  }, []);

  return { track };
}
