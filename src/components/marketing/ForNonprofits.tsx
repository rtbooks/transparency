import Link from "next/link";

export function ForNonprofits() {
  return (
    <section className="border-t bg-blue-600 py-16 text-white">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-center text-4xl font-bold">
            Ready to Stand Out?
          </h2>
          <p className="mb-8 text-center text-xl text-blue-100">
            Join the movement of nonprofits building unprecedented trust through 
            complete financial transparency.
          </p>

          <div className="mb-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-blue-700 p-6">
              <div className="mb-2 text-3xl">🤝</div>
              <h3 className="mb-2 text-lg font-semibold">Build Trust</h3>
              <p className="text-sm text-blue-100">
                Donors give more when they can see exactly where their money goes.
              </p>
            </div>

            <div className="rounded-lg bg-blue-700 p-6">
              <div className="mb-2 text-3xl">⏱️</div>
              <h3 className="mb-2 text-lg font-semibold">Save Time</h3>
              <p className="text-sm text-blue-100">
                Automated dashboards replace manual financial reports and updates.
              </p>
            </div>

            <div className="rounded-lg bg-blue-700 p-6">
              <div className="mb-2 text-3xl">🌟</div>
              <h3 className="mb-2 text-lg font-semibold">Stand Out</h3>
              <p className="text-sm text-blue-100">
                Differentiate from competitors who only share annual summaries.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/register"
              className="inline-block rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-600 transition-colors hover:bg-gray-50"
            >
              Get Started Free
            </Link>
            <p className="mt-4 text-sm text-blue-100">
              No credit card required · Set up in minutes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
