/**
 * Standard Chart of Accounts template for 501(c)(3) nonprofit organizations
 */

export interface AccountTemplate {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  parentCode?: string;
  description?: string;
}

export const NONPROFIT_SIMPLE_TEMPLATE: AccountTemplate[] = [
  // ASSETS
  {
    code: "1000",
    name: "Cash and Cash Equivalents",
    type: "ASSET",
    description: "All cash accounts",
  },
  { code: "1010", name: "Operating Checking Account", type: "ASSET", parentCode: "1000" },
  { code: "1020", name: "Savings Account", type: "ASSET", parentCode: "1000" },
  { code: "1030", name: "Petty Cash", type: "ASSET", parentCode: "1000" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },

  // LIABILITIES
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "2200", name: "Deferred Revenue", type: "LIABILITY" },

  // NET ASSETS
  { code: "3000", name: "Net Assets", type: "EQUITY" },

  // REVENUE
  { code: "4000", name: "Donations", type: "REVENUE" },
  { code: "4100", name: "Program Service Revenue", type: "REVENUE" },
  { code: "4200", name: "Fundraising Events", type: "REVENUE" },
  { code: "4300", name: "Investment Income", type: "REVENUE" },

  // EXPENSES
  { code: "5000", name: "Program Expenses", type: "EXPENSE" },
  { code: "5140", name: "Insurance", type: "EXPENSE", parentCode: "5100" },
  { code: "5150", name: "Professional Fees", type: "EXPENSE", parentCode: "5100" },
  { code: "5200", name: "Fundraising Expenses", type: "EXPENSE" },
  { code: "5220", name: "Event Costs", type: "EXPENSE", parentCode: "5200" },
  { code: "5230", name: "Marketing and Communications", type: "EXPENSE", parentCode: "5200" },
];

export const NONPROFIT_STANDARD_TEMPLATE: AccountTemplate[] = [
  // ASSETS
  {
    code: "1000",
    name: "Cash and Cash Equivalents",
    type: "ASSET",
    description: "All cash accounts",
  },
  { code: "1010", name: "Operating Checking Account", type: "ASSET", parentCode: "1000" },
  { code: "1020", name: "Savings Account", type: "ASSET", parentCode: "1000" },
  { code: "1030", name: "Petty Cash", type: "ASSET", parentCode: "1000" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1110", name: "Grants Receivable", type: "ASSET", parentCode: "1100" },
  { code: "1120", name: "Pledges Receivable", type: "ASSET", parentCode: "1100" },
  { code: "1200", name: "Property and Equipment", type: "ASSET" },
  { code: "1210", name: "Equipment", type: "ASSET", parentCode: "1200" },
  { code: "1220", name: "Accumulated Depreciation", type: "ASSET", parentCode: "1200" },

  // LIABILITIES
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "2100", name: "Accrued Expenses", type: "LIABILITY" },
  { code: "2110", name: "Accrued Payroll", type: "LIABILITY", parentCode: "2100" },
  { code: "2200", name: "Deferred Revenue", type: "LIABILITY" },

  // NET ASSETS
  { code: "3000", name: "Net Assets Without Donor Restrictions", type: "EQUITY" },
  { code: "3100", name: "Net Assets With Donor Restrictions", type: "EQUITY" },
  { code: "3110", name: "Temporarily Restricted", type: "EQUITY", parentCode: "3100" },
  { code: "3120", name: "Permanently Restricted", type: "EQUITY", parentCode: "3100" },

  // REVENUE
  { code: "4000", name: "Contributions", type: "REVENUE" },
  { code: "4010", name: "Individual Donations", type: "REVENUE", parentCode: "4000" },
  { code: "4020", name: "Corporate Donations", type: "REVENUE", parentCode: "4000" },
  { code: "4030", name: "Foundation Grants", type: "REVENUE", parentCode: "4000" },
  { code: "4100", name: "Program Service Revenue", type: "REVENUE" },
  { code: "4110", name: "Program Fees", type: "REVENUE", parentCode: "4100" },
  { code: "4200", name: "Fundraising Events", type: "REVENUE" },
  { code: "4210", name: "Event Ticket Sales", type: "REVENUE", parentCode: "4200" },
  { code: "4220", name: "Event Sponsorships", type: "REVENUE", parentCode: "4200" },
  { code: "4300", name: "Investment Income", type: "REVENUE" },

  // EXPENSES
  { code: "5000", name: "Program Expenses", type: "EXPENSE" },
  { code: "5010", name: "Program Salaries", type: "EXPENSE", parentCode: "5000" },
  { code: "5020", name: "Program Supplies", type: "EXPENSE", parentCode: "5000" },
  { code: "5030", name: "Program Travel", type: "EXPENSE", parentCode: "5000" },
  { code: "5100", name: "Management and General", type: "EXPENSE" },
  { code: "5110", name: "Administrative Salaries", type: "EXPENSE", parentCode: "5100" },
  { code: "5120", name: "Office Rent", type: "EXPENSE", parentCode: "5100" },
  { code: "5130", name: "Office Supplies", type: "EXPENSE", parentCode: "5100" },
  { code: "5140", name: "Insurance", type: "EXPENSE", parentCode: "5100" },
  { code: "5150", name: "Professional Fees", type: "EXPENSE", parentCode: "5100" },
  { code: "5160", name: "Technology", type: "EXPENSE", parentCode: "5100" },
  { code: "5200", name: "Fundraising Expenses", type: "EXPENSE" },
  { code: "5210", name: "Fundraising Salaries", type: "EXPENSE", parentCode: "5200" },
  { code: "5220", name: "Event Costs", type: "EXPENSE", parentCode: "5200" },
  { code: "5230", name: "Marketing and Communications", type: "EXPENSE", parentCode: "5200" },
];

export function getTemplate(name: "nonprofit-standard" | "nonprofit-simple"): AccountTemplate[] {
  switch (name) {
    case "nonprofit-standard":
      return NONPROFIT_STANDARD_TEMPLATE;
    case "nonprofit-simple":
      return NONPROFIT_SIMPLE_TEMPLATE;
    default:
      return [];
  }
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  accountCount: number;
  suitable: string[];
}

export const AVAILABLE_TEMPLATES: TemplateInfo[] = [
  {
    id: "nonprofit-standard",
    name: "Nonprofit Standard",
    description: "Comprehensive chart of accounts for 501(c)(3) organizations",
    accountCount: NONPROFIT_STANDARD_TEMPLATE.length,
    suitable: ["501(c)(3)", "Charities", "Youth Programs"],
  },
  {
    id: "nonprofit-simple",
    name: "Nonprofit Simple",
    description: "Basic chart of accounts for small nonprofits with minimal transactions",
    accountCount: NONPROFIT_SIMPLE_TEMPLATE.length,
    suitable: ["Small Nonprofits", "Startups", "Community Groups"],
  },
];
