import { AccessToken, AgentDispatchClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { difficultyMap, positionNames } from '@/lib/constants';

const VALID_POSITIONS = Object.keys(positionNames);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      room_name,
      participant_name,
      participant_identity,
      resume,
      difficulty,
      interview_id,
    } = body;

    // 验证 position 参数
    const validPosition = VALID_POSITIONS.includes(body.position) ? body.position : 'frontend';

    const roomName = room_name || `interview-${Date.now()}`;
    const identity = participant_identity || `user-${Date.now()}`;
    const name = participant_name || 'Candidate';

    const difficultyLabel = difficultyMap[difficulty] || difficulty || '中级';

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;
    const agentName = process.env.AGENT_NAME || 'interview-agent';

    if (!apiKey || !apiSecret || !wsUrl) {
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      );
    }

    // Create participant token
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      metadata: JSON.stringify({
        position: validPosition,
        resume: resume || '',
        difficulty: difficultyLabel,
      }),
      ttl: '30m',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Set participant attributes for the agent to read
    at.attributes = {
      'interview.position': validPosition,
      'interview.difficulty': difficultyLabel,
      'interview.name': name,
    };

    if (interview_id) {
      at.attributes['interview.id'] = interview_id;
    }

    if (resume) {
      at.attributes['interview.resume'] = resume;
    }

    const token = await at.toJwt();

    // Explicitly dispatch the agent to the room
    try {
      // AgentDispatchClient needs HTTP URL, not WebSocket
      const httpUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
      const agentDispatchClient = new AgentDispatchClient(
        httpUrl,
        apiKey,
        apiSecret
      );

      const dispatch = await agentDispatchClient.createDispatch(roomName, agentName, {
        metadata: JSON.stringify({
          position: validPosition,
          resume: resume || '',
          difficulty: difficultyLabel,
          interview_id: interview_id || '',
        }),
      });
      console.log(`Agent dispatched to room: ${roomName}, dispatch:`, JSON.stringify(dispatch));
    } catch (dispatchError: unknown) {
      const errMsg = dispatchError instanceof Error ? dispatchError.message : String(dispatchError);
      const errStack = dispatchError instanceof Error ? dispatchError.stack : '';
      console.error('Agent dispatch error:', errMsg, errStack);
      // Continue even if dispatch fails - agent might auto-join
    }

    return NextResponse.json({
      serverUrl: wsUrl,
      participantToken: token,
      roomName,
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
