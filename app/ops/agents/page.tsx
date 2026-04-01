import { redirect } from 'next/navigation';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import AgentActions from './AgentActions';

type AgentRow = {
  id: string;
  email: string;
  business_name: string | null;
  agent_contact_email: string | null;
  created_at: string;
};

type AgentInviteRow = {
  id: string;
  personal_email: string;
  contact_email: string;
  token: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

export default async function OpsAgentsPage() {
  // Admin-only page
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

  if (!user || !adminEmails.includes(user.email?.toLowerCase() ?? '')) {
    redirect('/');
  }

  const db = createAdminClient();

  const { data: agents } = await db
    .from('users')
    .select('id, email, business_name, agent_contact_email, created_at')
    .eq('is_agent', true)
    .order('created_at', { ascending: false });

  const { data: invites } = await db
    .from('agent_invites')
    .select('id, personal_email, contact_email, token, created_at, expires_at, accepted_at')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Agent Management</h1>
        <span className="text-sm text-gray-500">{(agents ?? []).length} agents</span>
      </div>

      {/* Invite form */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Invite New Agent
        </h2>
        <AgentActions />
      </div>

      {/* Pending invites */}
      {(invites ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Pending Invites
          </h2>
          <div className="space-y-2">
            {((invites ?? []) as AgentInviteRow[]).map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-4">
                  <span className="text-white">{invite.personal_email}</span>
                  <span className="text-gray-500">→</span>
                  <span className="font-mono text-violet-400">{invite.contact_email}</span>
                </div>
                <span className="text-xs text-amber-400">
                  Expires {new Date(invite.expires_at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active agents */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Active Agents
        </h2>
        {(agents ?? []).length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center text-gray-600">
            No agents yet. Invite one above.
          </div>
        ) : (
          <div className="space-y-2">
            {((agents ?? []) as AgentRow[]).map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg border border-gray-800 bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-white">{agent.email}</span>
                      {agent.business_name && (
                        <span className="text-sm text-gray-400">{agent.business_name}</span>
                      )}
                    </div>
                    {agent.agent_contact_email && (
                      <p className="text-xs font-mono text-violet-400">
                        {agent.agent_contact_email}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <time className="text-xs text-gray-600">
                      Joined {new Date(agent.created_at).toLocaleDateString('en-CA', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </time>
                    <AgentActions agentId={agent.id} agentEmail={agent.email} contactEmail={agent.agent_contact_email} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
