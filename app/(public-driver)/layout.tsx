import React from "react";

export default function PublicDriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {children}
    </div>
  );
}
