import {describe,it,expect} from "vitest";
import {parseCalendarCsv} from "@/lib/ics/csv";
import {parseIcs} from "@/lib/ics/ical";
import {findAvailableSlots,timeInsights} from "@/features/planning/lib/planning";
import type {EventRecord} from "@/features/calendar/types";
const event:EventRecord={id:"e",calendarId:"c",title:"Meeting",description:"",location:"",startAt:"2026-10-24T13:00:00Z",endAt:"2026-10-24T14:00:00Z",timezone:"America/Toronto",allDay:false,status:"confirmed",labels:[]};
describe("planning and portability",()=>{
 it("imports quoted CSV fields and private all-day events",()=>{const data='Subject,Start Date,End Date,All Day Event,Description,Private\r\n"A, B",10/24/2026,10/24/2026,True,"Line 1\nLine 2",True';const result=parseCalendarCsv(data,"America/Toronto");expect(result.events[0]!.title).toBe("A, B");expect(result.events[0]!.description).toBe("Line 1\nLine 2");expect(result.events[0]!.visibility).toBe("private");expect(result.events[0]!.startAt).toBe(result.events[0]!.endAt);});
 it("imports AM/PM times",()=>{const result=parseCalendarCsv('Subject,Start Date,Start Time,End Time\nMeeting,10/24/2026,12:00 PM,1:00 PM',"America/Toronto");expect(result.events[0]!.startAt).toBe("2026-10-24T16:00:00.000Z");expect(result.events[0]!.endAt).toBe("2026-10-24T17:00:00.000Z");});
 it("reports invalid CSV rows",()=>expect(parseCalendarCsv('Subject,Start Date\nBad,banana',"UTC").notes).toHaveLength(1));
 it("finds gaps and permits adjacency",()=>{const slots=findAvailableSlots([event],"2026-10-24","America/Toronto",540,660,60);expect(slots).toHaveLength(1);expect(slots[0]!.startAt).toBe("2026-10-24T14:00:00.000Z");});
 it("ignores free and cancelled events for availability",()=>expect(findAvailableSlots([{...event,availability:"free"}],"2026-10-24","America/Toronto",540,600,60)).toHaveLength(1));
 it("blocks an all-day event",()=>expect(findAvailableSlots([{...event,allDay:true,startAt:"2026-10-24T04:00:00Z",endAt:"2026-10-24T04:00:00Z"}],"2026-10-24","America/Toronto",540,600,60)).toHaveLength(0));
 it("clips insights to range and excludes cancelled entries",()=>expect(timeInsights([event,{...event,status:"cancelled"}],new Date("2026-10-24T13:30:00Z"),new Date("2026-10-24T14:00:00Z"))).toEqual({event:0.5}));
 it("imports recurrence overrides without duplicating their original slot",()=>{const text='BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:series\nSUMMARY:Original\nDTSTART:20261024T130000Z\nDTEND:20261024T140000Z\nRRULE:FREQ=DAILY;COUNT=2\nEND:VEVENT\nBEGIN:VEVENT\nUID:series\nSUMMARY:Moved\nRECURRENCE-ID:20261025T130000Z\nDTSTART:20261025T150000Z\nDTEND:20261025T160000Z\nEND:VEVENT\nEND:VCALENDAR';const r=parseIcs(text,"UTC");expect(r.events[0]!.rrule).toContain("EXDATE:2026-10-25T13:00:00.000Z");expect(r.events).toHaveLength(2);});
});
