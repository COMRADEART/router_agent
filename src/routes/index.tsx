import { createFileRoute } from "@tanstack/react-router";
import { Island } from "@/components/island/island";

export const Route = createFileRoute("/")({ component: Island });

