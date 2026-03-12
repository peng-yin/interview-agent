import type { Room } from '@livekit/rtc-node';

/**
 * 通过 DataChannel 发送 JSON 数据（封装 TextEncoder + publishData）
 */
export async function publishJsonData(
  room: Room,
  topic: string,
  data: Record<string, unknown>,
): Promise<void> {
  const encoder = new TextEncoder();
  const payload = encoder.encode(JSON.stringify(data));
  await room.localParticipant!.publishData(payload, {
    reliable: true,
    topic,
  });
}
