/**
 * ProPublica Nonprofit Explorer API Integration
 * Used for verifying 501(c)(3) organizations via EIN lookup
 * 
 * API Docs: https://projects.propublica.org/nonprofits/api
 * Rate Limit: Unknown - be conservative
 */

export interface ProPublicaOrganization {
  ein: string;
  name: string;
  city: string;
  state: string;
  ntee_code?: string;
  subsection_code?: string;
  affiliation_code?: string;
  classification_code?: string;
  deductibility_code?: string;
  foundation_code?: string;
  organization_code?: string;
  pub78_verified: boolean;
  filings_with_data?: Array<{
    tax_prd: number;
    tax_prd_yr: number;
    formtype: string;
    pdf_url?: string;
    updated?: string;
  }>;
}

export interface EINVerificationResult {
  verified: boolean;
  organization?: {
    name: string;
    city: string;
    state: string;
    nteeCode?: string;
    pub78Verified: boolean; // Appears on IRS Pub 78 (eligible for tax-deductible donations)
    filingHistory?: Array<{
      year: number;
      formType: string;
    }>;
  };
  error?: string;
}

const PROPUBLICA_API_BASE = 'https://projects.propublica.org/nonprofits/api/v2';

/**
 * Verify an EIN with the ProPublica Nonprofit Explorer API
 * 
 * @param ein - The 9-digit EIN (with or without hyphen)
 * @returns Verification result with organization data
 */
export async function verifyEIN(ein: string): Promise<EINVerificationResult> {
  // Clean EIN: remove hyphens and validate format
  const cleanEIN = ein.replace(/-/g, '');
  
  if (!/^\d{9}$/.test(cleanEIN)) {
    return {
      verified: false,
      error: 'Invalid EIN format. Must be 9 digits.',
    };
  }

  try {
    const response = await fetch(`${PROPUBLICA_API_BASE}/organizations/${cleanEIN}.json`, {
      headers: {
        'User-Agent': 'FinancialTransparencyPlatform/1.0',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          verified: false,
          error: 'Organization not found in IRS database. Please verify the EIN is correct.',
        };
      }

      if (response.status === 429) {
        return {
          verified: false,
          error: 'Rate limit exceeded. Please try again in a few moments.',
        };
      }

      return {
        verified: false,
        error: `API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    const org = data.organization as ProPublicaOrganization;

    if (!org) {
      return {
        verified: false,
        error: 'Unexpected API response format.',
      };
    }

    return {
      verified: true,
      organization: {
        name: org.name,
        city: org.city,
        state: org.state,
        nteeCode: org.ntee_code,
        pub78Verified: org.pub78_verified || false,
        filingHistory: org.filings_with_data?.slice(0, 5).map(filing => ({
          year: filing.tax_prd_yr,
          formType: filing.formtype,
        })),
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          verified: false,
          error: 'Request timed out. Please try again.',
        };
      }

      return {
        verified: false,
        error: `Verification failed: ${error.message}`,
      };
    }

    return {
      verified: false,
      error: 'An unknown error occurred during verification.',
    };
  }
}

/**
 * Format EIN with hyphen (XX-XXXXXXX)
 */
export function formatEIN(ein: string): string {
  const cleanEIN = ein.replace(/-/g, '');
  if (cleanEIN.length === 9) {
    return `${cleanEIN.slice(0, 2)}-${cleanEIN.slice(2)}`;
  }
  return ein;
}

/**
 * Validate EIN format
 */
export function isValidEINFormat(ein: string): boolean {
  const cleanEIN = ein.replace(/-/g, '');
  return /^\d{9}$/.test(cleanEIN);
}
