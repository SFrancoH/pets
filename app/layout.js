import "./globals.css";

export const metadata = {
  title: "PETS",
  description: "Administración segura de empresas, usuarios y mascotas"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
