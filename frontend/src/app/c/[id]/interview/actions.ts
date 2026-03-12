'use server';

import { updateInterviewCandidate as dbUpdateCandidate, updateInterviewRoom as dbUpdateRoom } from '@/lib/db';

export async function updateInterviewCandidate(id: string, name: string, email: string) {
  dbUpdateCandidate(id, name, email);
}

export async function updateInterviewRoom(id: string, roomName: string) {
  dbUpdateRoom(id, roomName);
}
