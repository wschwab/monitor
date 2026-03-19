/**
 * Monitor Web Frontend
 *
 * Next.js app for task creation, live feed, and results viewing.
 */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}