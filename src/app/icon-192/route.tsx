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
          background: 'linear-gradient(135deg, #15803D 0%, #22C55E 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
          fontWeight: 800,
          fontSize: 120,
        }}
      >
        D
      </div>
    ),
    { width: 192, height: 192 }
  );
}
