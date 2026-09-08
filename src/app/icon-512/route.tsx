import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#059669',
          color: '#fff',
          fontFamily: 'sans-serif',
          fontWeight: 800,
          fontSize: 320,
        }}
      >
        D
      </div>
    ),
    { width: 512, height: 512 }
  );
}
