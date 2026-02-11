import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";

export function Hero() {
  return (
    <section className="border-b bg-gradient-to-b from-blue-50 to-white py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <FadeIn>
            <h1 className="mb-6 text-6xl font-bold tracking-tight text-gray-900">
              Radical Transparency for Nonprofits
            </h1>
          </FadeIn>
          <FadeIn delay={100}>
            <p className="mb-8 text-xl text-gray-600">
              Give donors the confidence to give more. Show exactly where every 
              dollar goes with real-time financial dashboards.
            </p>
          </FadeIn>
          <FadeIn delay={200}>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/organizations"
                className="rounded-lg bg-blue-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
              >
                Browse Organizations
              </Link>
              <Link
                href="/about"
                className="rounded-lg border-2 border-gray-300 px-8 py-4 text-lg font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
              >
                Learn More
              </Link>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
