// run in mobile folder to deploy on supabase "npx supabase functions deploy process-ride-event --no-verify-jwt"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`--- [START] Function Triggered at ${timestamp} ---`);

  try {
    const payload = await req.json();
    const { type, table, record, old_record } = payload;
    console.log(`Event Type: ${type} | Table: ${table}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

  const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`;

  // Adding Content-Type explicitly helps avoid 401/400 errors
  const authHeader = { 
    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    'Content-Type': 'application/json'
  };

    if (table === 'ride_participants') {
      const isNewJoin = (type === 'INSERT');
      const isRejoin = (type === 'UPDATE' && old_record?.status === 'left' && record?.status === 'joined');
      const isLeft = (type === 'UPDATE' && old_record?.status === 'joined' && record?.status === 'left');
      
      if (isNewJoin || isRejoin || isLeft) {
        console.log(`Step 1: Fetching ride ${record.ride_id}...`);
        
        // FIX: Using ride_type and start_name instead of title
        const { data: ride, error: rErr } = await supabase
          .from('rides')
          .select('id, start_name, ride_type, owner_id, join_mode') 
          .eq('id', record.ride_id)
          .single();
        
        if (rErr || !ride) {
          console.error("Ride lookup failed:", rErr);
          return new Response("Ride not found", { status: 404 });
        }

        if (ride.owner_id === record.user_id) {
          console.log("Action by Owner: Skipping notification.");
          return new Response("Owner action - skipping", { status: 200 });
        }

        console.log(`Step 2: Fetching profile ${record.user_id}...`);
        const { data: profile, error: pErr } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', record.user_id)
          .single();

        if (ride && profile) {
          const name = profile.display_name || 'A rider';
          const rideLabel = ride.start_name || ride.ride_type || 'Ride'; // Human-friendly label
          
          let title = '';
          let body = '';

          if (isLeft) {
            title = 'Rider Left';
            body = `${name} has left your ride: ${rideLabel}`;
          } else if (ride.join_mode === 'express') {
            title = isRejoin ? 'Rider Returned' : 'New Rider Joined';
            body = `${name} ${isRejoin ? 'is back for' : 'has joined'} the ${ride.ride_type} ride at ${ride.start_name || 'start'}`;
          } else {
            title = 'Join Request';
            body = `${name} wants to join your ${ride.ride_type} ride`;
          }

          console.log(`Step 3: Sending to owner ${ride.owner_id}...`);
          const notifyRes = await fetch(functionUrl, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ 
              userId: ride.owner_id, 
              type: 'status_update', 
              title, 
              body, 
              data: { rideId: ride.id } 
            })
          });
          
          console.log(`Step 4: Notification service responded: ${notifyRes.status}`);
        }
      }
      
      // Handle Approval/Rejection
      const isApproved = (type === 'UPDATE' && old_record?.status === 'pending' && record?.status === 'joined');
      const isRejected = (type === 'UPDATE' && old_record?.status === 'pending' && record?.status === 'rejected');

      if (isApproved || isRejected) {
        const { data: ride } = await supabase.from('rides').select('id, start_name, ride_type').eq('id', record.ride_id).single();
        if (ride) {
          const rideLabel = ride.start_name || ride.ride_type || 'Ride';
          console.log(`Notifying Rider of Decision...`);
          await fetch(functionUrl, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({ 
              userId: record.user_id, 
              type: 'decision', 
              title: isApproved ? 'Ride Approved!' : 'Request Update', 
              body: isApproved ? `You're in for the ride at ${rideLabel}` : `Request for ${rideLabel} was not accepted.`, 
              data: { rideId: ride.id } 
            })
          });
        }
      }
    }

    // CASE 2: Ride Cancellation
    if (table === 'rides' && type === 'UPDATE') {
      if (old_record?.status !== 'cancelled' && record?.status === 'cancelled') {
        const { data: participants } = await supabase.from('ride_participants').select('user_id').eq('ride_id', record.id).neq('user_id', record.owner_id);
        if (participants) {
          for (const p of participants) {
            await fetch(functionUrl, {
              method: 'POST',
              headers: authHeader,
              body: JSON.stringify({
                userId: p.user_id,
                type: 'ride_update',
                title: 'Ride Cancelled',
                body: `The ride at ${record.start_name || 'your location'} has been cancelled.`,
                data: { rideId: record.id }
              })
            });
          }
        }
      }
    }

    // CASE 3: New Ride Created - Notify Followers
    if (table === 'rides' && type === 'INSERT' && record?.status === 'published') {
      console.log(`New ride created by ${record.owner_id}, notifying followers...`);

      // Get owner's display name
      const { data: owner, error: ownerErr } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', record.owner_id)
        .single();

      if (ownerErr) {
        console.log('Error fetching owner profile:', ownerErr);
      }

      // Get all followers of this owner
      const { data: followers, error: followErr } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', record.owner_id);

      if (followErr) {
        console.log('Error fetching followers:', followErr);
      }

      if (followers && followers.length > 0) {
        console.log(`Found ${followers.length} followers to notify`);
        const ownerName = owner?.display_name || 'Someone you follow';
        const rideType = record.ride_type || 'Ride';
        const location = record.start_name || 'a new location';

        for (const f of followers) {
          console.log(`Notifying follower ${f.follower_id}...`);
          const notifyRes = await fetch(functionUrl, {
            method: 'POST',
            headers: authHeader,
            body: JSON.stringify({
              userId: f.follower_id,
              type: 'new_ride',
              title: `${ownerName} created a new ride!`,
              body: `${rideType} at ${location}`,
              data: { rideId: record.id }
            })
          });
          console.log(`Follower notification response: ${notifyRes.status}`);
          if (!notifyRes.ok) {
            const errText = await notifyRes.text();
            console.log(`Follower notification error: ${errText}`);
          }
        }
      } else {
        console.log('No followers to notify');
      }
    }

    console.log("--- [FINISH] Logic completed successfully ---");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });

  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})