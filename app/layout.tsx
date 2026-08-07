import type { Metadata } from "next";
import { CaptureProlificParams } from "@/components/CaptureProlificParams";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workplace AI Study",
  description: "A research study about workplace AI use",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CaptureProlificParams />
        {children}
      </body>
    </html>
  );
}
