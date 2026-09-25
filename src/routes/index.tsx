import { createFileRoute } from "@tanstack/react-router";
import { FumeApp } from "@/components/fume-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <FumeApp />;
}
