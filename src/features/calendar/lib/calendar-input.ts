import {z} from "zod";
export const calendarInput=z.object({name:z.string().trim().min(1).max(100),color:z.string().regex(/^(#[0-9a-fA-F]{6}|work|personal|study|health)$/)});
