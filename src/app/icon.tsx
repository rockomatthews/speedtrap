import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512
};

export const contentType = 'image/png';

export default function Icon() {
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
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 64,
            width: 384,
            height: 56,
            borderRadius: 12,
            background: '#FFD200'
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 150,
            left: 64,
            width: 320,
            height: 36,
            borderRadius: 10,
            background: '#fff'
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 206,
            left: 64,
            width: 384,
            height: 36,
            borderRadius: 10,
            background: '#FF2A2A'
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 262,
            left: 64,
            width: 288,
            height: 32,
            borderRadius: 10,
            background: '#fff'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 64,
            left: 64,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: 1
          }}
        >
          STR
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}

