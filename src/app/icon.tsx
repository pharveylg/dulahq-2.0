import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 7,
          color: '#fff',
          fontFamily: 'sans-serif',
          fontWeight: 800,
          fontSize: 20,
        }}
      >
        D
      </div>
    ),
    { ...size }
  );
}
