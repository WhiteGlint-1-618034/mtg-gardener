import { createFileRoute } from "@tanstack/react-router";
import { GardenerApp } from "@/components/gardener-app";

export const Route = createFileRoute("/")({ component: GardenerApp });
