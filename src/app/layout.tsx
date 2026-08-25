import './globals.css';
import { Providers } from '@/components/providers';
export const metadata = {
  title: 'Prefeitura de Mimoso do Sul | Abastecimento',
  description: 'Controle municipal de combustíveis',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
