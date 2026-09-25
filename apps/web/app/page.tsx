import { HomeDashboard } from "@/components/home-dashboard";
import { PageHeader } from "@/components/page-header";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 lg:py-10">
      <PageHeader title="Anorganická chemie" />
      <HomeDashboard />
    </main>
  );
}
