import "./style.css";
export const metadata = { title: "Speed Trap Race Control", robots: { index: false, follow: false } };
export default function Layout({ children }) {
  return <html lang="en"><body><header><strong>SPEED TRAP</strong><span>Race Control / Test</span></header>{children}</body></html>;
}
