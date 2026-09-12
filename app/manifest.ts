import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KSS Roadways ERP',
    short_name: 'KSS ERP',
    description: 'KSS Roadways Fleet Management Portal',
    start_url: '/',
    display: 'standalone', // This hides the Chrome URL browser bar!
    background_color: '#050507',
    theme_color: '#FF5A00',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
