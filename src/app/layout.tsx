import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DATA LAB AI — Oficina de agentes",
  description: "Oficina virtual 3D donde 9 agentes de IA trabajan en proyectos reales de datos.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
