import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#000',
          color: '#fff',
          fontFamily: 'Arial',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: 22, left: 18, width: 144, height: 20, borderRadius: 6, background: '#FFD200' }} />
        <div style={{ position: 'absolute', top: 50, left: 18, width: 120, height: 14, borderRadius: 5, background: '#fff' }} />
        <div style={{ position: 'absolute', top: 72, left: 18, width: 144, height: 14, borderRadius: 5, background: '#FF2A2A' }} />
        <div style={{ position: 'absolute', top: 94, left: 18, width: 108, height: 12, borderRadius: 5, background: '#fff' }} />
        <div style={{ position: 'absolute', bottom: 18, left: 18, fontSize: 40, fontWeight: 800 }}>STR</div>
      </div>
    ),
    {
      ...size
    }
  );
}

