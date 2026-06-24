import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GenPanel - Intelligent Arbitration",
  description: "Decentralized arbitration and resolution protocol powered by GenLayer AI consensus",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#090d16" }}>
        {children}
      </body>
    </html>
  );
}
