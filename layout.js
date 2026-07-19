import "./globals.css";

export const metadata = {
  title: "The Will of Focus",
  description: "Turn study hours into levels, ranks, and streaks.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
