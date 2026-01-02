// scripts/createUsers.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Add your beta users here
const users = [
  { 
    email: 'shlomzi@bishvil.com', 
    password: 'shlom123', 
    name: 'Shlomzion',
    phone: '+972544933815'
  },
  //{ 
    //email: 'eli@bishvil.com', 
    //password: 'eli123', 
    //name: 'Eli',
    //phone: '+972507654321'
  //},
  // Add more users...
];

async function createUsers() {
  console.log('Creating users in Supabase...\n');
  
  for (const user of users) {
    try {
      // Create user with admin API - bypasses email verification
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        phone_confirm: user.phone ? true : undefined,
        phone: user.phone,
        user_metadata: {
          name: user.name
        }
      });

      if (error) {
        console.error(`❌ Failed to create ${user.email}:`, error.message);
        continue;
      }

      console.log(`✅ Created ${user.email}`);
      console.log(`   User ID: ${data.user.id}`);
      console.log(`   Password: ${user.password}`);

      // Upsert profile entry (create or update if trigger already created it)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            display_name: user.name,
          },
          { 
            onConflict: 'id',
            ignoreDuplicates: false
          }
        )
        .select();

      if (profileError) {
        console.error(`   ⚠️  Profile creation failed:`, profileError.message);
      } else {
        console.log(`   ✅ Profile created/updated`);
      }
      console.log('');

    } catch (err) {
      console.error(`❌ Exception creating ${user.email}:`, err.message);
    }
  }
  
  console.log('\n✨ Done! Send credentials to users via secure channel.');
}

createUsers().catch(console.error);