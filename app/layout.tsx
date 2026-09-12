import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KSS Roadways ERP",
  description: "KSS Roadways Fleet Management Portal",
  manifest: "/manifest.json", 
  themeColor: "#050507",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KSS Roadways",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        
        {/* PWA Service Worker Registration Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  }, function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
