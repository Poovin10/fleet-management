import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KSS Roadways ERP',
    short_name: 'KSS ERP',
    description: 'KSS Roadways Fleet Management ERP',
    start_url: '/',
    display: 'standalone',
    background_color: '#0F1117',
    theme_color: '#FF5A00',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
