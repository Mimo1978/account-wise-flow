import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkspaceResponse {
  success: boolean;
  workspaceId?: string;
  workspaceName?: string;
  error?: string;
  details?: Record<string, unknown>;
  workspaces?: Array<{
    id: string;
    name: string;
    isDemo: boolean;
    workspaceMode: string;
    type: string;
    role: string;
  }>;
}

// Use any for Supabase client to avoid complex generic issues in edge functions
type SupabaseAdmin = SupabaseClient<any, any, any>;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create client with service role for admin operations
    const supabaseAdmin: SupabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create client with anon key to verify user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized', details: { authError: authError?.message } }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();
    
    console.log(`[workspace-management] Action: ${action}, User: ${user.id}, Email: ${user.email}`);

    let response: WorkspaceResponse;

    switch (action) {
      case 'get-demo-workspace':
        response = await getDemoWorkspace(supabaseAdmin);
        break;
      
      case 'join-demo':
        response = await joinDemoWorkspace(supabaseAdmin, user.id);
        break;
      
      case 'create-workspace':
        const createBody = await req.json().catch(() => ({}));
        response = await createUserWorkspace(supabaseAdmin, user.id, createBody.name || 'My Workspace');
        break;
      
      case 'seed-demo':
        const seedBody = await req.json().catch(() => ({}));
        response = await seedDemoWorkspace(supabaseAdmin, seedBody.workspaceId, user.id);
        break;
      
      case 'get-user-workspaces':
        response = await getUserWorkspaces(supabaseAdmin, user.id);
        break;

      default:
        response = { success: false, error: `Unknown action: ${action}` };
    }

    const status = response.success ? 200 : 400;
    return new Response(
      JSON.stringify(response),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const error = err as Error;
    console.error('[workspace-management] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', details: { message: error.message } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Get or create the demo workspace
 */
async function getDemoWorkspace(supabase: SupabaseAdmin): Promise<WorkspaceResponse> {
  console.log('[getDemoWorkspace] Looking for demo workspace...');
  
  // Find existing demo workspace (not public_demo)
  const { data: existing, error: findError } = await supabase
    .from('teams')
    .select('id, name')
    .eq('is_demo', true)
    .eq('workspace_mode', 'demo')
    .maybeSingle();

  if (existing) {
    console.log('[getDemoWorkspace] Found existing demo workspace:', existing.id);
    return { success: true, workspaceId: existing.id, workspaceName: existing.name };
  }

  // Create demo workspace if not found
  console.log('[getDemoWorkspace] Creating new demo workspace...');
  const { data: created, error: createError } = await supabase
    .from('teams')
    .insert({
      name: 'Demo Workspace',
      is_demo: true,
      workspace_mode: 'demo',
      type: 'demo'
    })
    .select('id, name')
    .single();

  if (createError) {
    console.error('[getDemoWorkspace] Failed to create demo workspace:', createError);
    return { success: false, error: 'Failed to create demo workspace', details: { dbError: createError.message } };
  }

  console.log('[getDemoWorkspace] Created demo workspace:', created.id);
  return { success: true, workspaceId: created.id, workspaceName: created.name };
}

/**
 * Join user to demo workspace (idempotent)
 */
async function joinDemoWorkspace(supabase: SupabaseAdmin, userId: string): Promise<WorkspaceResponse> {
  console.log('[joinDemoWorkspace] User:', userId);
  
  // Get demo workspace
  const demoResult = await getDemoWorkspace(supabase);
  if (!demoResult.success || !demoResult.workspaceId) {
    return demoResult;
  }

  const workspaceId = demoResult.workspaceId;
  console.log('[joinDemoWorkspace] Demo workspace ID:', workspaceId);

  // Check if user already has a role in demo workspace
  const { data: existingRole, error: roleCheckError } = await supabase
    .from('user_roles')
    .select('id, role')
    .eq('user_id', userId)
    .eq('team_id', workspaceId)
    .maybeSingle();

  if (roleCheckError) {
    console.error('[joinDemoWorkspace] Error checking existing role:', roleCheckError);
  }

  if (existingRole) {
    console.log('[joinDemoWorkspace] User already has role in demo workspace:', existingRole.role);
    return { success: true, workspaceId, workspaceName: demoResult.workspaceName };
  }

  // Create membership for user in demo workspace
  console.log('[joinDemoWorkspace] Creating user role...');
  const { error: insertError } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      team_id: workspaceId,
      role: 'contributor' // Full access in demo
    });

  if (insertError) {
    // Check if it's a unique constraint violation (already exists)
    if (insertError.code === '23505') {
      console.log('[joinDemoWorkspace] Role already exists (race condition), continuing...');
      return { success: true, workspaceId, workspaceName: demoResult.workspaceName };
    }
    console.error('[joinDemoWorkspace] Failed to create role:', insertError);
    return { success: false, error: 'Failed to join demo workspace', details: { dbError: insertError.message, code: insertError.code } };
  }

  console.log('[joinDemoWorkspace] Successfully joined demo workspace');
  
  // Seed demo data automatically after joining
  console.log('[joinDemoWorkspace] Triggering demo seed...');
  await seedDemoWorkspace(supabase, workspaceId, userId);
  
  return { success: true, workspaceId, workspaceName: demoResult.workspaceName };
}

/**
 * Create a new blank workspace for user
 */
async function createUserWorkspace(supabase: SupabaseAdmin, userId: string, workspaceName: string): Promise<WorkspaceResponse> {
  console.log('[createUserWorkspace] User:', userId, 'Name:', workspaceName);

  // Check if user already has a non-demo workspace
  const { data: existingRoles, error: checkError } = await supabase
    .from('user_roles')
    .select('team_id')
    .eq('user_id', userId);

  if (checkError) {
    console.error('[createUserWorkspace] Error checking existing workspaces:', checkError);
  }

  // Check each team to find non-demo workspace
  if (existingRoles && existingRoles.length > 0) {
    for (const role of existingRoles) {
      const { data: team } = await supabase
        .from('teams')
        .select('id, name, is_demo')
        .eq('id', role.team_id)
        .single();
      
      if (team && !team.is_demo) {
        console.log('[createUserWorkspace] User already has real workspace:', team.id);
        return { 
          success: true, 
          workspaceId: team.id, 
          workspaceName: team.name,
          details: { existing: true }
        };
      }
    }
  }

  // Create new workspace
  console.log('[createUserWorkspace] Creating new workspace...');
  const { data: newWorkspace, error: createError } = await supabase
    .from('teams')
    .insert({
      name: workspaceName,
      is_demo: false,
      workspace_mode: 'production',
      type: 'real'
    })
    .select('id, name')
    .single();

  if (createError) {
    console.error('[createUserWorkspace] Failed to create workspace:', createError);
    return { success: false, error: 'Failed to create workspace', details: { dbError: createError.message } };
  }

  // Add user as admin of new workspace
  console.log('[createUserWorkspace] Adding user as admin...');
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      team_id: newWorkspace.id,
      role: 'admin'
    });

  if (roleError) {
    console.error('[createUserWorkspace] Failed to add user role:', roleError);
    // Try to clean up the orphaned workspace
    await supabase.from('teams').delete().eq('id', newWorkspace.id);
    return { success: false, error: 'Failed to set workspace permissions', details: { dbError: roleError.message } };
  }

  console.log('[createUserWorkspace] Successfully created workspace:', newWorkspace.id);
  return { success: true, workspaceId: newWorkspace.id, workspaceName: newWorkspace.name };
}

/**
 * Seed demo workspace with sample data (idempotent)
 */
async function seedDemoWorkspace(supabase: SupabaseAdmin, workspaceId: string, userId: string): Promise<WorkspaceResponse> {
  console.log('[seedDemoWorkspace] Workspace:', workspaceId, 'User:', userId);

  if (!workspaceId) {
    return { success: false, error: 'Missing workspaceId' };
  }

  // Verify workspace is a demo workspace
  const { data: workspace, error: wsError } = await supabase
    .from('teams')
    .select('id, name, is_demo')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) {
    console.error('[seedDemoWorkspace] Workspace not found:', wsError);
    return { success: false, error: 'Workspace not found' };
  }

  if (!workspace.is_demo) {
    console.error('[seedDemoWorkspace] Cannot seed non-demo workspace');
    return { success: false, error: 'Cannot seed a production workspace' };
  }

  // Check if data already exists
  const { count: companyCount } = await supabase
    .from('companies')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', workspaceId);

  if (companyCount && companyCount > 0) {
    console.log('[seedDemoWorkspace] Demo data already exists, skipping seed');
    return { success: true, workspaceId, details: { alreadySeeded: true, companyCount } };
  }

  // Call the seed function
  console.log('[seedDemoWorkspace] Calling seed_demo_workspace...');
  const { error: seedError } = await supabase.rpc('seed_demo_workspace', {
    workspace_uuid: workspaceId
  });

  if (seedError) {
    console.error('[seedDemoWorkspace] Failed to seed:', seedError);
    return { success: false, error: 'Failed to seed demo data', details: { dbError: seedError.message } };
  }

  console.log('[seedDemoWorkspace] Successfully seeded demo workspace');
  return { success: true, workspaceId, workspaceName: workspace.name };
}

/**
 * Get all workspaces for a user
 */
async function getUserWorkspaces(supabase: SupabaseAdmin, userId: string): Promise<WorkspaceResponse> {
  console.log('[getUserWorkspaces] User:', userId);

  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('role, team_id')
    .eq('user_id', userId);

  if (error) {
    console.error('[getUserWorkspaces] Error:', error);
    return { success: false, error: 'Failed to fetch workspaces', details: { dbError: error.message } };
  }

  const workspaces = [];
  
  for (const role of userRoles || []) {
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, is_demo, workspace_mode, type')
      .eq('id', role.team_id)
      .single();
    
    if (team) {
      workspaces.push({
        id: team.id,
        name: team.name,
        isDemo: team.is_demo,
        workspaceMode: team.workspace_mode,
        type: team.type,
        role: role.role
      });
    }
  }

  console.log('[getUserWorkspaces] Found workspaces:', workspaces.length);
  return { success: true, workspaces };
}
