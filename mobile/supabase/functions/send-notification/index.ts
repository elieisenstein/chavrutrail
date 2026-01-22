// supabase/functions/send-notification/index.ts
// run in mobile folder to deploy on supabase "npx supabase functions deploy send-notification --no-verify-jwt"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')

interface NotificationRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  // Expanded to match the process-ride-event logic
  type: string; 
}

Deno.serve(async (req) => {
  try {
    const { userId, title, body, data, type }: NotificationRequest = await req.json()
    console.log(`Processing notification for ${userId}, Type: ${type}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('expo_push_token')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.expo_push_token) {
      console.error(`Token Error: ${profileError?.message || 'No token found'}`);
      return new Response(JSON.stringify({ error: 'No token found' }), { status: 404 })
    }

    // Map notification type to Android channel ID
    const channelId =
      (type === 'request' || type === 'approval' || type === 'decision' || type === 'status_update')
      ? 'requests_approvals'
      : (type === 'new_ride')
      ? 'new_rides'
      : 'ride_updates';

    const message = {
      to: profile.expo_push_token,
      sound: 'default',
      title,
      body,
      data: data || {},
      channelId, // Android notification channel - OS handles user preferences
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(message),
    })

    const result = await response.json()
    console.log("EXPO API RESPONSE:", JSON.stringify(result));

    // Save to history
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body,
        data,
        read: false,
      })

    return new Response(JSON.stringify({ success: true, result }), { status: 200 })

  } catch (error) {
    console.error("Critical Send Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})