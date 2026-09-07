import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 110,
        }}
      >
        D
      </div>
    ),
    { ...size }
  );
}
