const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

function setup(role = 'admin', exists = true) {
  const calls = [];
  const query = {
    update(value) { calls.push(['update', value]); return query; },
    eq(key, value) { calls.push(['filter', key, value]); return query; },
    select() { return query; },
    async maybeSingle() { return { data: exists ? { id: 'old-season' } : null, error: null }; }
  };
  const route = loader({
    '@/lib/supabase/admin-role': { getCurrentUserAndAdminRole: async () => ({ user: role ? {id:'staff'} : null, role }) },
    '@/lib/supabase/admin': { createSupabaseAdminClient: () => ({ from(table) { calls.push(['table',table]); return query; } }) }
  })('src/app/api/admin/leagues/[id]/route.ts');
  return { calls, remove: () => route.DELETE(new Request('https://example.test'), {params:Promise.resolve({id:'old-season'})}) };
}
test('removing a league archives only that season without deleting related records', async () => {
  const f=setup(); assert.equal((await f.remove()).status,200);
  assert.deepEqual(f.calls,[['table','leagues'],['update',{status:'archived',visibility:'private'}],['filter','id','old-season']]);
});
test('league removal requires admin and reports missing season', async () => {
  for (const [role,status] of [[null,401],['member',403]]) {
    const f=setup(role);assert.equal((await f.remove()).status,status);assert.equal(f.calls.length,0);
  }
  assert.equal((await setup('admin',false).remove()).status,404);
});
test('removed league direct public URL returns not found', async () => {
  const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:{id:'old-season',status:'archived'},error:null};}};
  const {getLeagueStandings}=loader({
    'next/navigation':{notFound(){throw new Error('NOT_FOUND');}},
    '@/lib/supabase/admin':{createSupabaseAdminClient:()=>({from:()=>query})},
    '@/lib/vms/client':{VmsClient:{}}
  })('src/lib/leagues/standings.ts');
  await assert.rejects(()=>getLeagueStandings('old-season'),/NOT_FOUND/);
});
