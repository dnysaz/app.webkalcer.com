import { CrmProvider } from "@/components/CrmProvider";
import { AuthProvider } from "@/components/AuthProvider";
import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CrmProvider>{children}</CrmProvider>
    </AuthProvider>
  );
}
