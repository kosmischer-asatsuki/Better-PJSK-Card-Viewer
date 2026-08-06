import type { Metadata } from "next";
import { headers } from "next/headers";
import cardsData from "./cards.json";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  const description = `浏览 26 名 Project SEKAI 角色的 ${cardsData.length} 张卡面，支持团体、角色与星级多重筛选、个人评分和原图预览。`;

  return {
    title: "PJSK 卡面档案室｜SEKAI ARCHIVE",
    description,
    openGraph: {
      title: "PJSK 卡面档案室｜SEKAI ARCHIVE",
      description,
      type: "website",
      locale: "zh_CN",
      siteName: "SEKAI ARCHIVE",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "PJSK 卡面档案室" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "PJSK 卡面档案室｜SEKAI ARCHIVE",
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
