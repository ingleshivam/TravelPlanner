import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Travel Planner",
  description: "Plan your perfect trip with AI — transport, accommodation, and day-by-day itinerary within your budget.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" suppressHydrationWarning>
        <CopilotKit runtimeUrl="/api/copilotkit" agent="travel_planner">
          {children}
        </CopilotKit>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
