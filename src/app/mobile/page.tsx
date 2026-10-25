import {redirect} from 'next/navigation';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {ensureDefaultWorkspaceForUser} from '@/server/services/workspace-service';
import {prisma} from '@/lib/prisma/client';
import {CalendarShell} from '@/features/calendar/components/CalendarShell';
export const dynamic='force-dynamic';
export default async function MobileWorkspace(){const supabase=await createSupabaseServerClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login?next=/mobile');const {workspaceId}=await ensureDefaultWorkspaceForUser(user.id,{email:user.email,displayName:user.user_metadata?.full_name});const profile=await prisma.userProfile.findUnique({where:{id:user.id}});return <CalendarShell workspaceId={workspaceId} timeZone={profile?.defaultTimezone??'America/Toronto'}/>;}
