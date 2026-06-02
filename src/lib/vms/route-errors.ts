import { NextResponse } from 'next/server';

import { VmsError } from '@/lib/vms/client';

export function vmsErrorResponse(error: unknown) {
  if (error instanceof VmsError) {
    const status = error.status === 401 || error.status === 403 || error.status === 429 ? error.status : 502;
    return NextResponse.json(
      {
        error: error.message,
        upstreamStatus: error.status,
        ...(error.status === 403
          ? {
              requiredPermissions: [
                'Global Write Access',
                'Access Customer Personally Identifiable Information',
                'Customer Read Access'
              ]
            }
          : {})
      },
      { status }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unexpected VMS integration error.' },
    { status: 500 }
  );
}
