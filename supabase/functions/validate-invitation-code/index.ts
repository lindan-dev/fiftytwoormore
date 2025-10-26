import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { code } = await req.json()
    
    if (!code || typeof code !== 'string' || code.length !== 8) {
      return new Response(
        JSON.stringify({ error: 'Invalid code format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Validating invitation code:', code)

    // Fetch ALL pending invitations (using service role)
    const { data: invitations, error: fetchError } = await supabase
      .from('couple_invitations')
      .select('*')
      .eq('status', 'pending')

    if (fetchError) {
      console.error('Error fetching invitations:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to validate code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find matching invitation by code prefix
    const matchingInvite = invitations?.find((inv) =>
      inv.id.toUpperCase().startsWith(code.toUpperCase())
    )

    if (!matchingInvite) {
      console.log('No matching invitation found for code:', code)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is not trying to use their own code
    if (matchingInvite.sender_id === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot use your own invitation code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Valid invitation found:', matchingInvite.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation: {
          id: matchingInvite.id,
          sender_id: matchingInvite.sender_id
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
