import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const payload = await req.json()
  const { record, old_record, type, table } = payload

  // We use the system-provided keys that are ALREADY there
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
  const authHeader = { 
    'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    'Content-Type': 'application/json' 
  }

  // 1. PARTICIPANT LOGIC (Joins & Approvals)
  if (table === 'ride_participants') {
    if (type === 'INSERT') {
      const { data: ride } = await supabase.from('rides').select('title, user_id').eq('id', record.ride_id).single()
      const { data: joiner } = await supabase.from('profiles').select('full_name').eq('id', record.user_id).single()

      await fetch(functionUrl, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          userId: ride.user_id,
          type: 'request',
          title: 'New Rider Request',
          body: `${joiner.full_name} wants to join ${ride.title}`,
          data: { rideId: record.ride_id }
        })
      })
    }

    if (type === 'UPDATE' && old_record.status === 'pending' && record.status === 'approved') {
      const { data: ride } = await supabase.from('rides').select('title').eq('id', record.ride_id).single()

      await fetch(functionUrl, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          userId: record.user_id,
          type: 'approval',
          title: 'Ride Approved!',
          body: `You have been approved for: ${ride.title}`,
          data: { rideId: record.ride_id }
        })
      })
    }
  }

  // 2. RIDE LOGIC (Cancellations & Updates)
  if (table === 'rides' && type === 'UPDATE') {
    const isCanceled = record.status === 'canceled' && old_record.status !== 'canceled'
    
    if (isCanceled) {
      const { data: participants } = await supabase
        .from('ride_participants')
        .select('user_id')
        .eq('ride_id', record.id)
        .eq('status', 'approved')

      if (participants?.length) {
        await Promise.all(participants.map(p => 
          fetch(functionUrl, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              userId: p.user_id,
              type: 'ride_update',
              title: 'Ride Canceled 🚫',
              body: `The ride "${record.title}" has been canceled.`,
              data: { rideId: record.id }
            })
          })
        ))
      }
    }
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})