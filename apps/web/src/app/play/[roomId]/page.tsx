"use client";

import { use } from "react";
import dynamic from "next/dynamic";

const GameClient = dynamic(() => import("@/components/GameClient"), {
  ssr: false,
  loading: () => <p style={{ padding: "2rem", color: "#e5e1e4", fontFamily: "Outfit, sans-serif" }}>Đang kết nối vào đấu trường...</p>,
});

export default function PlayPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return <GameClient roomId={roomId} />;
}
