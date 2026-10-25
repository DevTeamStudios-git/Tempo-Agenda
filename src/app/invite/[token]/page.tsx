import {getInvitation} from "@/server/services/invitation-service";
import {InvitationResponse} from "@/features/events/components/InvitationResponse";
import {formatInTimeZone} from "date-fns-tz";
export const dynamic="force-dynamic";
export const metadata={title:"Event invitation",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function InvitationPage({params}:{params:Promise<{token:string}>}){const {token}=await params;try{const a=await getInvitation(token),e=a.event;return <div className="invite-page"><article className="dlg"><p>Invitation from {e.createdBy.displayName}</p><h1>{e.title}</h1><p>{formatInTimeZone(e.startAt,e.timezone,"EEEE, MMMM d, yyyy · h:mm a")} ({e.timezone})</p><p>{e.location}</p><p style={{whiteSpace:"pre-wrap"}}>{e.description}</p>{e.conferenceUrl&&<a href={e.conferenceUrl} rel="noreferrer">Join meeting</a>}<InvitationResponse token={token} initial={a.responseStatus}/></article></div>;}catch{return <div className="invite-page"><article className="dlg"><h1>Invitation unavailable</h1><p>This invitation expired, was revoked, or the event was cancelled.</p></article></div>;}}
