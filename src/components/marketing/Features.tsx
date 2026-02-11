export function Features() {
  const features = [
    {
      emoji: "🔍",
      title: "Complete Transparency",
      description: "Every transaction visible with full details. Donors see exactly where their money goes."
    },
    {
      emoji: "📊",
      title: "Real-Time Dashboards",
      description: "Beautiful financial dashboards that update automatically. Always current, always accurate."
    },
    {
      emoji: "🏦",
      title: "Double-Entry Accounting",
      description: "Professional-grade bookkeeping ensures accuracy and audit-readiness."
    },
    {
      emoji: "🎯",
      title: "Planned Purchases",
      description: "Show what you plan to spend before spending. Build support for future needs."
    },
    {
      emoji: "💳",
      title: "Integrated Donations",
      description: "Accept donations directly with Stripe. Donors track their contributions in real time."
    },
    {
      emoji: "🔒",
      title: "Privacy Protected",
      description: "Financial transparency without exposing donor identities. Personal data stays private."
    }
  ];

  return (
    <section className="border-t bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-4xl font-bold">
            Everything You Need
          </h2>
          <p className="mb-12 text-center text-lg text-gray-600">
            Professional tools that make financial transparency simple
          </p>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-3 text-4xl">{feature.emoji}</div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
