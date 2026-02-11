import { Suspense } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { Hero } from "@/components/marketing/Hero";
import { SocialProof } from "@/components/marketing/SocialProof";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Features } from "@/components/marketing/Features";
import { FeaturedOrganizations } from "@/components/marketing/FeaturedOrganizations";
import { ForNonprofits } from "@/components/marketing/ForNonprofits";
import { UserDashboard } from "@/components/marketing/UserDashboard";

export default async function Home() {
  const user = await currentUser();

  // If user is logged in, show personalized dashboard
  if (user) {
    return (
      <Suspense fallback={<div className="p-8">Loading...</div>}>
        <UserDashboard user={user} />
      </Suspense>
    );
  }

  // If not logged in, show marketing landing page
  return (
    <div className="bg-white">
      <Hero />
      
      <Suspense fallback={<div className="py-8" />}>
        <SocialProof />
      </Suspense>

      <HowItWorks />

      <Features />

      <Suspense fallback={<div className="py-8" />}>
        <FeaturedOrganizations />
      </Suspense>

      <ForNonprofits />
    </div>
  );
}
