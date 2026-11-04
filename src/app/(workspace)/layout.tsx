import { SearchProvider } from "@/components/shell/SearchContext";
import { TabsBar } from "@/components/shell/TabsBar";
import { TopHeader } from "@/components/shell/TopHeader";
import shell from "@/components/shell/shell.module.css";
import { ThemeSync } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { requireDb } from "@/lib/db";
import { requireUser } from "@/server/auth/server";
import { readUserTheme } from "@/server/base/preferences";

export const dynamic = 'force-dynamic';

/** The theme saved on the account; the default is used when there is none or the database is not reachable. */
async function savedTheme(userId: string) {
  try { return await readUserTheme(requireDb(), userId); } catch { return null; }
}

/** All workspace pages require a verified, explicitly approved administrator. */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const theme = await savedTheme(user.id);
  return (
    <ToastProvider>
      <SearchProvider>
        <ThemeSync saved={theme} />
        <div className={shell.app}>
          <TopHeader email={user.email} />
          <TabsBar />
          {children}
        </div>
      </SearchProvider>
    </ToastProvider>
  );
}
