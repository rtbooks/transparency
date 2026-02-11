export function HowItWorks() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-4xl font-bold">How It Works</h2>
          
          <div className="grid gap-12 lg:grid-cols-2">
            {/* For Nonprofits */}
            <div>
              <h3 className="mb-6 text-2xl font-semibold text-blue-600">
                For Nonprofits
              </h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                    1
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Sign Up & Verify</h4>
                    <p className="text-sm text-gray-600">
                      Create an account and verify your 501(c)(3) status. Only 
                      legitimate charities join the platform.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                    2
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Set Up Accounts</h4>
                    <p className="text-sm text-gray-600">
                      Build your chart of accounts with professional double-entry 
                      bookkeeping. Import data or start fresh.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-600">
                    3
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Publish & Share</h4>
                    <p className="text-sm text-gray-600">
                      Your dashboard goes live. Share your URL with donors and 
                      supporters to build unprecedented trust.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Donors */}
            <div>
              <h3 className="mb-6 text-2xl font-semibold text-green-600">
                For Donors
              </h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-600">
                    1
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Browse Organizations</h4>
                    <p className="text-sm text-gray-600">
                      Explore verified nonprofits committed to complete transparency. 
                      Filter by cause, location, or size.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-600">
                    2
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">See Every Detail</h4>
                    <p className="text-sm text-gray-600">
                      View real-time financial data down to individual transactions. 
                      See program spending ratios and overhead costs.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-600">
                    3
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Donate with Confidence</h4>
                    <p className="text-sm text-gray-600">
                      Make informed decisions with complete information. Donate 
                      directly through the platform.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
