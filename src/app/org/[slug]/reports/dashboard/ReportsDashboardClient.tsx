'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MonthlyData {
  label: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

interface AssetData {
  name: string;
  value: number;
}

interface ReportsDashboardClientProps {
  organizationName: string;
  fiscalYearLabel: string;
  fiscalYears: Array<{ label: string; startDate: string }>;
  currentFiscalYear: string;
  monthlyData: MonthlyData[];
  assetComposition: AssetData[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatDollar(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ReportsDashboardClient({
  organizationName,
  fiscalYearLabel,
  fiscalYears,
  currentFiscalYear,
  monthlyData,
  assetComposition,
  totalAssets,
  totalLiabilities,
  totalEquity,
}: ReportsDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleFYChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('fy', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
  const totalNetIncome = totalRevenue - totalExpenses;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Financial Dashboard
          </h1>
          <p className="mt-1 text-gray-600">
            {organizationName} — {fiscalYearLabel}
          </p>
        </div>
        <Select value={currentFiscalYear} onValueChange={handleFYChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Fiscal Year" />
          </SelectTrigger>
          <SelectContent>
            {fiscalYears.map((fy) => (
              <SelectItem key={fy.startDate} value={fy.startDate}>
                {fy.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total Revenue" value={totalRevenue} color="text-green-700" />
        <SummaryCard label="Total Expenses" value={totalExpenses} color="text-red-700" />
        <SummaryCard
          label="Net Income"
          value={totalNetIncome}
          color={totalNetIncome >= 0 ? 'text-green-700' : 'text-red-700'}
        />
        <SummaryCard label="Total Assets" value={totalAssets} color="text-blue-700" />
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue vs Expenses bar chart */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Revenue vs Expenses by Month
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatDollar(value)} />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
              <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Net Income trend */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Net Income Trend
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatDollar} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatDollar(value)} />
              <Line
                type="monotone"
                dataKey="netIncome"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Net Income"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Asset composition */}
        {assetComposition.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Asset Composition
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={assetComposition}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {assetComposition.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatDollar(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Financial position summary */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Financial Position
          </h2>
          <div className="space-y-4">
            <PositionBar label="Assets" value={totalAssets} color="bg-blue-500" />
            <PositionBar label="Liabilities" value={totalLiabilities} color="bg-red-400" />
            <PositionBar label="Equity" value={totalEquity} color="bg-green-500" />
          </div>
          <div className="mt-4 rounded bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              Assets: {formatDollar(totalAssets)} = Liabilities:{' '}
              {formatDollar(totalLiabilities)} + Equity: {formatDollar(totalEquity)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>
        {formatDollar(value)}
      </p>
    </div>
  );
}

function PositionBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium">{formatDollar(value)}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: '100%', maxWidth: '100%' }}
        />
      </div>
    </div>
  );
}
