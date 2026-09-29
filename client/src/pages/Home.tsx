import { PageShell } from "@/components/layout/PageShell";
import { DirectorySection } from "@/features/directory/DirectorySection";
import { EventsSection } from "@/features/home/EventsSection";
import { Hero } from "@/features/home/Hero";
import { InstitutionSection } from "@/features/home/InstitutionSection";
import { SocietySection } from "@/features/home/SocietySection";
import { MembershipSection } from "@/features/membership/MembershipSection";

export default function Home() {
  return (
    <PageShell>
      <Hero />
      <SocietySection />
      <InstitutionSection />
      <DirectorySection />
      <MembershipSection />
      <EventsSection />
    </PageShell>
  );
}
