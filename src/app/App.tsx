import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Button } from './components/ui/button';
import { Switch } from './components/ui/switch';
import { Alert, AlertDescription } from './components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/ui/collapsible';
import { Badge } from './components/ui/badge';
import { 
  InfoIcon, 
  RotateCcwIcon, 
  CopyIcon, 
  DownloadIcon, 
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrencyCompactINR(amount: number): string {
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 10000000) { // 1 Crore = 10,000,000
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  } else if (absAmount >= 100000) { // 1 Lakh = 100,000
    return `₹${(amount / 100000).toFixed(2)}L`;
  } else if (absAmount >= 1000) {
    return `₹${(amount / 1000).toFixed(2)}K`;
  } else {
    return `₹${amount.toFixed(2)}`;
  }
}

function formatCurrencyExactINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatMultiple(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatNumberWithCommas(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(value);
}

// ============================================================================
// TAX CALCULATION HELPERS
// ============================================================================

/**
 * Returns the marginal tax rate based on total income using new regime style brackets
 */
function getMarginalTaxRate(totalIncome: number): number {
  if (totalIncome <= 300000) return 0;
  if (totalIncome <= 600000) return 5;
  if (totalIncome <= 900000) return 10;
  if (totalIncome <= 1200000) return 15;
  if (totalIncome <= 1500000) return 20;
  return 30;
}

/**
 * Returns the surcharge rate based on total income
 */
function getSurchargeRate(totalIncome: number): number {
  if (totalIncome <= 5000000) return 0;
  if (totalIncome <= 10000000) return 10;
  if (totalIncome <= 20000000) return 15;
  return 25;
}

/**
 * Calculates the effective exercise tax rate including surcharge and cess
 */
function getEffectiveExerciseTaxRate(totalIncomeAtExercise: number): number {
  const marginalRate = getMarginalTaxRate(totalIncomeAtExercise);
  const surchargeRate = getSurchargeRate(totalIncomeAtExercise);
  const cessRate = 4;
  
  // Formula: marginalRate * (1 + surcharge/100) * (1 + cess/100)
  const effectiveRate = (marginalRate / 100) * (1 + surchargeRate / 100) * (1 + cessRate / 100);
  
  return effectiveRate * 100; // Return as percentage
}

interface TaxBreakdown {
  annualSalary: number;
  perquisiteIncome: number;
  totalIncomeAtExercise: number;
  marginalTaxRate: number;
  surchargeRate: number;
  cessRate: number;
  effectiveExerciseTaxRate: number;
}

function calculateTaxBreakdown(
  annualSalary: number,
  perquisiteIncome: number
): TaxBreakdown {
  const totalIncomeAtExercise = annualSalary + perquisiteIncome;
  const marginalTaxRate = getMarginalTaxRate(totalIncomeAtExercise);
  const surchargeRate = getSurchargeRate(totalIncomeAtExercise);
  const cessRate = 4;
  const effectiveExerciseTaxRate = getEffectiveExerciseTaxRate(totalIncomeAtExercise);
  
  return {
    annualSalary,
    perquisiteIncome,
    totalIncomeAtExercise,
    marginalTaxRate,
    surchargeRate,
    cessRate,
    effectiveExerciseTaxRate,
  };
}

// ============================================================================
// CALCULATION ENGINE
// ============================================================================

interface CalculatorInputs {
  units: number;
  exercisePrice: number;
  currentFMV: number;
  sellingFMV: number;
  incomeTaxRate: number;
  ltcgRate: number;
  exitMultiple: number;
  useExitMultiple: boolean;
  useAutoTax: boolean;
  annualSalary: number;
}

interface CalculatorResults {
  exerciseCost: number;
  perquisiteIncome: number;
  exerciseTax: number;
  totalCashOutflow: number;
  paperValueAtExercise: number;
  derivedSellingFMV: number;
  saleValue: number;
  capitalGain: number;
  ltcgTax: number;
  totalTaxes: number;
  netProceeds: number;
  netProfit: number;
  postTaxMultiple: number;
  effectiveTaxRate: number;
}

function calculateESOPMetrics(inputs: CalculatorInputs): CalculatorResults {
  const {
    units,
    exercisePrice,
    currentFMV,
    sellingFMV,
    incomeTaxRate,
    ltcgRate,
    exitMultiple,
    useExitMultiple,
    useAutoTax,
    annualSalary,
  } = inputs;

  const exerciseCost = units * exercisePrice;
  const perquisiteIncome = units * (currentFMV - exercisePrice);
  
  // Determine effective tax rate
  let effectiveTaxRate: number;
  if (useAutoTax) {
    const totalIncomeAtExercise = annualSalary + perquisiteIncome;
    effectiveTaxRate = getEffectiveExerciseTaxRate(totalIncomeAtExercise);
  } else {
    effectiveTaxRate = incomeTaxRate;
  }
  
  const exerciseTax = perquisiteIncome * (effectiveTaxRate / 100);
  const totalCashOutflow = exerciseCost + exerciseTax;
  const paperValueAtExercise = units * currentFMV;
  
  const derivedSellingFMV = useExitMultiple ? currentFMV * exitMultiple : sellingFMV;
  const saleValue = units * derivedSellingFMV;
  const capitalGain = units * (derivedSellingFMV - currentFMV);
  const ltcgTax = Math.max(capitalGain, 0) * (ltcgRate / 100);
  
  const totalTaxes = exerciseTax + ltcgTax;
  const netProceeds = saleValue - ltcgTax;
  const netProfit = saleValue - exerciseCost - exerciseTax - ltcgTax;
  const postTaxMultiple = totalCashOutflow > 0 ? netProfit / totalCashOutflow : 0;

  return {
    exerciseCost,
    perquisiteIncome,
    exerciseTax,
    totalCashOutflow,
    paperValueAtExercise,
    derivedSellingFMV,
    saleValue,
    capitalGain,
    ltcgTax,
    totalTaxes,
    netProceeds,
    netProfit,
    postTaxMultiple,
    effectiveTaxRate,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateInputs(inputs: CalculatorInputs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (inputs.units <= 0) {
    errors.push('Number of units must be greater than 0');
  }

  if (inputs.currentFMV < inputs.exercisePrice) {
    errors.push('Current FMV cannot be less than Exercise Price');
  }

  if (inputs.useAutoTax && inputs.annualSalary < 0) {
    errors.push('Annual salary cannot be negative');
  }

  if (inputs.useExitMultiple) {
    const derivedSelling = inputs.currentFMV * inputs.exitMultiple;
    if (derivedSelling < inputs.currentFMV) {
      warnings.push('Exit multiple results in selling FMV lower than current FMV - capital gain will be negative');
    }
  } else {
    if (inputs.sellingFMV < 0) {
      errors.push('Selling FMV cannot be negative');
    }
    if (inputs.sellingFMV < inputs.currentFMV) {
      warnings.push('Selling FMV is lower than current FMV - capital gain will be negative');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// SCENARIO TABLE GENERATION
// ============================================================================

interface ScenarioRow {
  fmv: number;
  exerciseCost: number;
  perquisiteIncome: number;
  totalIncomeAtExercise?: number;
  marginalTaxRate?: number;
  surchargeRate?: number;
  effectiveTaxRate?: number;
  exerciseTax: number;
  totalCashOutflow: number;
  sellingFMV: number;
  saleValue: number;
  capitalGain: number;
  ltcgTax: number;
  netProfit: number;
}

function generateScenarioTable(
  startFMV: number,
  endFMV: number,
  step: number,
  baseInputs: CalculatorInputs
): ScenarioRow[] {
  const rows: ScenarioRow[] = [];
  
  for (let fmv = startFMV; fmv <= endFMV; fmv += step) {
    const inputs = { ...baseInputs, currentFMV: fmv };
    const results = calculateESOPMetrics(inputs);
    
    const row: ScenarioRow = {
      fmv,
      exerciseCost: results.exerciseCost,
      perquisiteIncome: results.perquisiteIncome,
      exerciseTax: results.exerciseTax,
      totalCashOutflow: results.totalCashOutflow,
      sellingFMV: results.derivedSellingFMV,
      saleValue: results.saleValue,
      capitalGain: results.capitalGain,
      ltcgTax: results.ltcgTax,
      netProfit: results.netProfit,
    };
    
    // Add auto tax details if enabled
    if (baseInputs.useAutoTax) {
      const perquisiteIncome = baseInputs.units * (fmv - baseInputs.exercisePrice);
      const totalIncomeAtExercise = baseInputs.annualSalary + perquisiteIncome;
      row.totalIncomeAtExercise = totalIncomeAtExercise;
      row.marginalTaxRate = getMarginalTaxRate(totalIncomeAtExercise);
      row.surchargeRate = getSurchargeRate(totalIncomeAtExercise);
      row.effectiveTaxRate = getEffectiveExerciseTaxRate(totalIncomeAtExercise);
    }
    
    rows.push(row);
  }
  
  return rows;
}

function exportScenarioTableToCSV(rows: ScenarioRow[], useAutoTax: boolean): string {
  const baseHeaders = [
    'FMV',
    'Exercise Cost',
    'Perquisite Income',
  ];
  
  const autoTaxHeaders = useAutoTax ? [
    'Total Income at Exercise',
    'Marginal Tax Rate',
    'Surcharge',
    'Effective Exercise Tax Rate',
  ] : [];
  
  const remainingHeaders = [
    'Exercise Tax',
    'Total Cash Outflow',
    'Selling FMV',
    'Sale Value',
    'Capital Gain',
    'LTCG Tax',
    'Net Profit',
  ];
  
  const headers = [...baseHeaders, ...autoTaxHeaders, ...remainingHeaders];
  const csvRows = [headers.join(',')];
  
  rows.forEach(row => {
    const baseData = [
      row.fmv,
      row.exerciseCost,
      row.perquisiteIncome,
    ];
    
    const autoTaxData = useAutoTax ? [
      row.totalIncomeAtExercise || 0,
      row.marginalTaxRate || 0,
      row.surchargeRate || 0,
      row.effectiveTaxRate || 0,
    ] : [];
    
    const remainingData = [
      row.exerciseTax,
      row.totalCashOutflow,
      row.sellingFMV,
      row.saleValue,
      row.capitalGain,
      row.ltcgTax,
      row.netProfit,
    ];
    
    csvRows.push([...baseData, ...autoTaxData, ...remainingData].join(','));
  });
  
  return csvRows.join('\n');
}

// ============================================================================
// SUMMARY TEXT GENERATOR
// ============================================================================

function generateSummary(
  inputs: CalculatorInputs, 
  results: CalculatorResults,
  taxBreakdown?: TaxBreakdown
): string {
  if (inputs.useAutoTax && taxBreakdown) {
    return `Based on a salary income of ${formatCurrencyExactINR(taxBreakdown.annualSalary)} and ESOP perquisite income of ${formatCurrencyExactINR(taxBreakdown.perquisiteIncome)}, the effective exercise tax rate is ${formatPercent(taxBreakdown.effectiveExerciseTaxRate)}. Your exercise cost is ${formatCurrencyCompactINR(results.exerciseCost)}, exercise tax is ${formatCurrencyCompactINR(results.exerciseTax)}, total upfront cash outflow is ${formatCurrencyCompactINR(results.totalCashOutflow)}, LTCG tax is ${formatCurrencyCompactINR(results.ltcgTax)}, and final net profit is ${formatCurrencyCompactINR(results.netProfit)}.`;
  }
  
  return `You exercise ${formatNumberWithCommas(inputs.units)} units at ${formatCurrencyExactINR(inputs.exercisePrice)} with an FMV of ${formatCurrencyExactINR(inputs.currentFMV)} and sell at ${formatCurrencyExactINR(results.derivedSellingFMV)}. Your exercise cost is ${formatCurrencyCompactINR(results.exerciseCost)}, exercise tax is ${formatCurrencyCompactINR(results.exerciseTax)}, total upfront cash outflow is ${formatCurrencyCompactINR(results.totalCashOutflow)}, LTCG tax is ${formatCurrencyCompactINR(results.ltcgTax)}, and final net profit is ${formatCurrencyCompactINR(results.netProfit)}.`;
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  // State for inputs
  const [units, setUnits] = useState(10000);
  const [exercisePrice, setExercisePrice] = useState(10);
  const [currentFMV, setCurrentFMV] = useState(400);
  const [sellingFMV, setSellingFMV] = useState(1200);
  const [incomeTaxRate, setIncomeTaxRate] = useState(34.32);
  const [ltcgRate, setLtcgRate] = useState(13);
  const [exitMultiple, setExitMultiple] = useState(3);
  const [useExitMultiple, setUseExitMultiple] = useState(true);
  const [showScenarioTable, setShowScenarioTable] = useState(true);
  const [scenarioStartFMV, setScenarioStartFMV] = useState(300);
  const [scenarioEndFMV, setScenarioEndFMV] = useState(400);
  const [scenarioStep, setScenarioStep] = useState(10);

  // New state for auto tax calculation
  const [useAutoTax, setUseAutoTax] = useState(false);
  const [annualSalary, setAnnualSalary] = useState(3000000);

  // State for collapsible sections
  const [isFormulaOpen, setIsFormulaOpen] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  // Calculate results
  const inputs: CalculatorInputs = {
    units,
    exercisePrice,
    currentFMV,
    sellingFMV,
    incomeTaxRate,
    ltcgRate,
    exitMultiple,
    useExitMultiple,
    useAutoTax,
    annualSalary,
  };

  const results = useMemo(() => calculateESOPMetrics(inputs), [
    units, exercisePrice, currentFMV, sellingFMV, incomeTaxRate, ltcgRate, 
    exitMultiple, useExitMultiple, useAutoTax, annualSalary
  ]);
  
  const taxBreakdown = useMemo(() => {
    if (useAutoTax) {
      return calculateTaxBreakdown(annualSalary, results.perquisiteIncome);
    }
    return undefined;
  }, [useAutoTax, annualSalary, results.perquisiteIncome]);
  
  const validation = useMemo(() => validateInputs(inputs), [inputs]);
  const scenarioRows = useMemo(() => {
    if (!showScenarioTable || scenarioStep <= 0) return [];
    return generateScenarioTable(scenarioStartFMV, scenarioEndFMV, scenarioStep, inputs);
  }, [showScenarioTable, scenarioStartFMV, scenarioEndFMV, scenarioStep, inputs]);

  const summary = useMemo(() => generateSummary(inputs, results, taxBreakdown), [inputs, results, taxBreakdown]);

  // Handlers
  const handleReset = () => {
    setUnits(10000);
    setExercisePrice(10);
    setCurrentFMV(400);
    setSellingFMV(1200);
    setIncomeTaxRate(34.32);
    setLtcgRate(13);
    setExitMultiple(3);
    setUseExitMultiple(true);
    setShowScenarioTable(true);
    setScenarioStartFMV(300);
    setScenarioEndFMV(400);
    setScenarioStep(10);
    setUseAutoTax(false);
    setAnnualSalary(3000000);
    toast.success('Reset to default values');
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard');
  };

  const handleDownloadCSV = () => {
    if (scenarioRows.length === 0) {
      toast.error('Enable scenario table to download CSV');
      return;
    }
    
    const csv = exportScenarioTableToCSV(scenarioRows, useAutoTax);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'esop-scenario-analysis.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded successfully');
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ESOP Tax & Exit Calculator
            </h1>
            <p className="text-slate-600 text-lg max-w-3xl mx-auto">
              Estimate exercise tax, capital gains tax, upfront cash outflow, and final post-tax profit from your ESOPs.
            </p>
          </header>

          {/* Info Banner */}
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <InfoIcon className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Important:</strong> Exercise tax is paid at the time of exercise on the perquisite value. 
              LTCG tax is paid later on sale gains.
              {useAutoTax && (
                <> Exercise tax is estimated using your salary plus ESOP perquisite income at exercise. 
                The calculator uses the marginal rate applicable to the ESOP income, plus surcharge and cess.</>
              )}
            </AlertDescription>
          </Alert>

          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangleIcon className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <ul className="list-disc list-inside">
                  {validation.errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation Warnings */}
          {validation.warnings.length > 0 && (
            <Alert className="mb-6 border-amber-200 bg-amber-50">
              <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <ul className="list-disc list-inside">
                  {validation.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Inputs Card */}
            <Card className="lg:col-span-1 shadow-lg">
              <CardHeader>
                <CardTitle>Inputs</CardTitle>
                <CardDescription>Enter your ESOP details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="units">Number of units</Label>
                  <Input
                    id="units"
                    type="number"
                    value={units}
                    onChange={(e) => setUnits(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="exercisePrice">Exercise price per unit (₹)</Label>
                  <Input
                    id="exercisePrice"
                    type="number"
                    value={exercisePrice}
                    onChange={(e) => setExercisePrice(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="currentFMV">Current FMV / Exercise FMV (₹)</Label>
                  <Input
                    id="currentFMV"
                    type="number"
                    value={currentFMV}
                    onChange={(e) => setCurrentFMV(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>

                <div className="flex items-center space-x-2 py-2">
                  <Switch
                    id="useExitMultiple"
                    checked={useExitMultiple}
                    onCheckedChange={setUseExitMultiple}
                  />
                  <Label htmlFor="useExitMultiple" className="cursor-pointer">
                    Use exit multiple instead of selling FMV
                  </Label>
                </div>

                {useExitMultiple ? (
                  <div>
                    <Label htmlFor="exitMultiple">Exit multiple</Label>
                    <Input
                      id="exitMultiple"
                      type="number"
                      step="0.1"
                      value={exitMultiple}
                      onChange={(e) => setExitMultiple(Number(e.target.value))}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Selling FMV = Current FMV × {exitMultiple} = ₹{(currentFMV * exitMultiple).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="sellingFMV">Selling FMV / Exit price per unit (₹)</Label>
                    <Input
                      id="sellingFMV"
                      type="number"
                      value={sellingFMV}
                      onChange={(e) => setSellingFMV(Number(e.target.value))}
                      className="mt-1.5"
                    />
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex items-center space-x-2 mb-4">
                    <Switch
                      id="useAutoTax"
                      checked={useAutoTax}
                      onCheckedChange={setUseAutoTax}
                    />
                    <Label htmlFor="useAutoTax" className="cursor-pointer font-semibold">
                      Auto calculate tax from salary + ESOP
                    </Label>
                  </div>

                  {useAutoTax ? (
                    <div>
                      <Label htmlFor="annualSalary">Annual Salary Income (₹)</Label>
                      <Input
                        id="annualSalary"
                        type="number"
                        value={annualSalary}
                        onChange={(e) => setAnnualSalary(Number(e.target.value))}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Your salary income excluding ESOP perquisite income
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="incomeTaxRate">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-help">
                              Income tax rate on perquisite (%)
                              <InfoIcon className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Tax rate applied on perquisite income (FMV - Exercise Price) at exercise. Example: 30% income tax + 10% surcharge + 4% cess = 34.32%
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        id="incomeTaxRate"
                        type="number"
                        step="0.01"
                        value={incomeTaxRate}
                        onChange={(e) => setIncomeTaxRate(Number(e.target.value))}
                        className="mt-1.5"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="ltcgRate">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1 cursor-help">
                          LTCG tax rate (%)
                          <InfoIcon className="h-3 w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Long-term capital gains tax rate applied on gains after holding for 24+ months. Example: 12.5% + 4% cess = 13%
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="ltcgRate"
                    type="number"
                    step="0.01"
                    value={ltcgRate}
                    onChange={(e) => setLtcgRate(Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center space-x-2 mb-4">
                    <Switch
                      id="showScenarioTable"
                      checked={showScenarioTable}
                      onCheckedChange={setShowScenarioTable}
                    />
                    <Label htmlFor="showScenarioTable" className="cursor-pointer">
                      Generate scenario table
                    </Label>
                  </div>

                  {showScenarioTable && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="scenarioStartFMV">Scenario start FMV (₹)</Label>
                        <Input
                          id="scenarioStartFMV"
                          type="number"
                          value={scenarioStartFMV}
                          onChange={(e) => setScenarioStartFMV(Number(e.target.value))}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="scenarioEndFMV">Scenario end FMV (₹)</Label>
                        <Input
                          id="scenarioEndFMV"
                          type="number"
                          value={scenarioEndFMV}
                          onChange={(e) => setScenarioEndFMV(Number(e.target.value))}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="scenarioStep">Scenario step (₹)</Label>
                        <Input
                          id="scenarioStep"
                          type="number"
                          value={scenarioStep}
                          onChange={(e) => setScenarioStep(Number(e.target.value))}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Formulas and Metrics */}
            <div className="lg:col-span-2 space-y-6">
              {/* Derived Tax Breakdown Card */}
              {useAutoTax && taxBreakdown && (
                <Card className="shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Derived Tax Breakdown
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        Auto
                      </Badge>
                    </CardTitle>
                    <CardDescription>Calculated from your salary + ESOP perquisite</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-slate-600 mb-1">Salary Income</div>
                        <div className="font-semibold">{formatCurrencyExactINR(taxBreakdown.annualSalary)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600 mb-1">ESOP Perquisite Income</div>
                        <div className="font-semibold">{formatCurrencyExactINR(taxBreakdown.perquisiteIncome)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600 mb-1">Total Income at Exercise</div>
                        <div className="font-semibold">{formatCurrencyExactINR(taxBreakdown.totalIncomeAtExercise)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600 mb-1">Marginal Tax Rate</div>
                        <div className="font-semibold">{formatPercent(taxBreakdown.marginalTaxRate)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600 mb-1">Surcharge</div>
                        <div className="font-semibold">{formatPercent(taxBreakdown.surchargeRate)}</div>
                      </div>
                      <div>
                        <div className="text-slate-600 mb-1">Cess</div>
                        <div className="font-semibold">{formatPercent(taxBreakdown.cessRate)}</div>
                      </div>
                      <div className="col-span-2 pt-3 border-t border-green-200">
                        <div className="text-slate-600 mb-1">Effective Exercise Tax Rate</div>
                        <div className="font-bold text-lg text-green-700">{formatPercent(taxBreakdown.effectiveExerciseTaxRate)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Formula Summary Card - Collapsible */}
              <Collapsible open={isFormulaOpen} onOpenChange={setIsFormulaOpen}>
                <Card className="shadow-lg">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Formula Summary</CardTitle>
                          <CardDescription>Calculation methodology</CardDescription>
                        </div>
                        {isFormulaOpen ? (
                          <ChevronUpIcon className="h-5 w-5 text-slate-500" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">Exercise Cost</div>
                          <div>Units × Exercise Price</div>
                        </div>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">Perquisite Income</div>
                          <div>Units × (Current FMV − Exercise Price)</div>
                        </div>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">Exercise Tax</div>
                          <div>Perquisite Income × {useAutoTax ? 'Effective' : 'Income'} Tax Rate</div>
                        </div>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">Sale Value</div>
                          <div>Units × Selling FMV</div>
                        </div>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">Capital Gain</div>
                          <div>Units × (Selling FMV − Current FMV)</div>
                        </div>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">LTCG Tax</div>
                          <div>Capital Gain × LTCG Rate</div>
                        </div>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">Net Profit</div>
                          <div>Sale Value − Exercise Cost − Exercise Tax − LTCG Tax</div>
                        </div>
                        <div className="font-mono text-xs bg-slate-50 p-3 rounded-md">
                          <div className="text-slate-600 mb-1">Post-tax Multiple</div>
                          <div>Net Profit ÷ Total Cash Outflow</div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricCard
                  label="Exercise Cost"
                  value={results.exerciseCost}
                  tooltip="Total amount paid to exercise your options"
                />
                <MetricCard
                  label="Exercise Tax"
                  value={results.exerciseTax}
                  tooltip="Tax paid on perquisite income at the time of exercise"
                  negative
                  badge={useAutoTax ? `Auto: ${formatPercent(results.effectiveTaxRate)}` : `Manual: ${formatPercent(incomeTaxRate)}`}
                />
                <MetricCard
                  label="Total Cash Outflow"
                  value={results.totalCashOutflow}
                  tooltip="Exercise cost + exercise tax (upfront payment required)"
                  highlighted
                />
                <MetricCard
                  label="Paper Value at Exercise"
                  value={results.paperValueAtExercise}
                  tooltip="Value of shares immediately after exercise"
                />
                <MetricCard
                  label="Sale Value"
                  value={results.saleValue}
                  tooltip="Total proceeds from selling shares at exit"
                />
                <MetricCard
                  label="LTCG Tax"
                  value={results.ltcgTax}
                  tooltip="Long-term capital gains tax paid on sale"
                  negative
                />
                <MetricCard
                  label="Total Taxes"
                  value={results.totalTaxes}
                  tooltip="Sum of exercise tax and LTCG tax"
                  negative
                />
                <MetricCard
                  label="Net Proceeds"
                  value={results.netProceeds}
                  tooltip="Sale value after deducting LTCG tax"
                />
                <MetricCard
                  label="Net Profit"
                  value={results.netProfit}
                  tooltip="Final profit after all costs and taxes"
                  featured
                  positive={results.netProfit > 0}
                />
                <MetricCard
                  label="Post-tax Multiple"
                  value={results.postTaxMultiple}
                  valueFormatter={formatMultiple}
                  tooltip="Net profit divided by total cash outflow"
                  isMultiple
                />
              </div>
            </div>
          </div>

          {/* Detailed Breakdown Table - Collapsible */}
          <Collapsible open={isBreakdownOpen} onOpenChange={setIsBreakdownOpen}>
            <Card className="mb-6 shadow-lg">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Detailed Breakdown</CardTitle>
                      <CardDescription>Complete calculation breakdown</CardDescription>
                    </div>
                    {isBreakdownOpen ? (
                      <ChevronUpIcon className="h-5 w-5 text-slate-500" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5 text-slate-500" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-semibold">Item</th>
                          <th className="text-right py-3 px-4 font-semibold">Value</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-500">Exact Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <BreakdownRow label="Units" value={formatNumberWithCommas(units)} exact="" />
                        <BreakdownRow label="Exercise Price" value={`₹${exercisePrice}`} exact="" />
                        <BreakdownRow label="Current FMV" value={`₹${currentFMV}`} exact="" />
                        <BreakdownRow label="Selling FMV" value={`₹${results.derivedSellingFMV}`} exact="" />
                        <BreakdownRow 
                          label="Exercise Cost" 
                          value={formatCurrencyCompactINR(results.exerciseCost)} 
                          exact={formatCurrencyExactINR(results.exerciseCost)}
                          highlighted 
                        />
                        <BreakdownRow 
                          label="Paper Value at Exercise" 
                          value={formatCurrencyCompactINR(results.paperValueAtExercise)} 
                          exact={formatCurrencyExactINR(results.paperValueAtExercise)} 
                        />
                        <BreakdownRow 
                          label="Perquisite Income" 
                          value={formatCurrencyCompactINR(results.perquisiteIncome)} 
                          exact={formatCurrencyExactINR(results.perquisiteIncome)} 
                        />
                        <BreakdownRow 
                          label="Exercise Tax" 
                          value={formatCurrencyCompactINR(results.exerciseTax)} 
                          exact={formatCurrencyExactINR(results.exerciseTax)}
                          negative 
                        />
                        <BreakdownRow 
                          label="Total Cash Outflow" 
                          value={formatCurrencyCompactINR(results.totalCashOutflow)} 
                          exact={formatCurrencyExactINR(results.totalCashOutflow)}
                          highlighted 
                        />
                        <BreakdownRow 
                          label="Sale Value" 
                          value={formatCurrencyCompactINR(results.saleValue)} 
                          exact={formatCurrencyExactINR(results.saleValue)}
                          highlighted 
                        />
                        <BreakdownRow 
                          label="Capital Gain" 
                          value={formatCurrencyCompactINR(results.capitalGain)} 
                          exact={formatCurrencyExactINR(results.capitalGain)} 
                        />
                        <BreakdownRow 
                          label="LTCG Tax" 
                          value={formatCurrencyCompactINR(results.ltcgTax)} 
                          exact={formatCurrencyExactINR(results.ltcgTax)}
                          negative 
                        />
                        <BreakdownRow 
                          label="Total Taxes" 
                          value={formatCurrencyCompactINR(results.totalTaxes)} 
                          exact={formatCurrencyExactINR(results.totalTaxes)}
                          negative 
                        />
                        <BreakdownRow 
                          label="Net Proceeds" 
                          value={formatCurrencyCompactINR(results.netProceeds)} 
                          exact={formatCurrencyExactINR(results.netProceeds)}
                          highlighted 
                        />
                        <BreakdownRow 
                          label="Net Profit" 
                          value={formatCurrencyCompactINR(results.netProfit)} 
                          exact={formatCurrencyExactINR(results.netProfit)}
                          featured
                          positive={results.netProfit > 0}
                        />
                        <BreakdownRow 
                          label="Post-tax Multiple" 
                          value={formatMultiple(results.postTaxMultiple)} 
                          exact=""
                          highlighted 
                        />
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Scenario Table */}
          {showScenarioTable && scenarioRows.length > 0 && (
            <Card className="mb-6 shadow-lg">
              <CardHeader>
                <CardTitle>Scenario Analysis</CardTitle>
                <CardDescription>
                  Analyzing FMV from ₹{scenarioStartFMV} to ₹{scenarioEndFMV} in steps of ₹{scenarioStep}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-semibold">FMV</th>
                        <th className="text-right py-3 px-2 font-semibold">Exercise Cost</th>
                        <th className="text-right py-3 px-2 font-semibold">Perquisite</th>
                        {useAutoTax && (
                          <>
                            <th className="text-right py-3 px-2 font-semibold">Total Income</th>
                            <th className="text-right py-3 px-2 font-semibold">Marginal Tax</th>
                            <th className="text-right py-3 px-2 font-semibold">Surcharge</th>
                            <th className="text-right py-3 px-2 font-semibold">Effective Tax</th>
                          </>
                        )}
                        <th className="text-right py-3 px-2 font-semibold">Exercise Tax</th>
                        <th className="text-right py-3 px-2 font-semibold">Cash Outflow</th>
                        <th className="text-right py-3 px-2 font-semibold">Selling FMV</th>
                        <th className="text-right py-3 px-2 font-semibold">Sale Value</th>
                        <th className="text-right py-3 px-2 font-semibold">Capital Gain</th>
                        <th className="text-right py-3 px-2 font-semibold">LTCG Tax</th>
                        <th className="text-right py-3 px-2 font-semibold bg-blue-50">Net Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {scenarioRows.map((row, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-slate-50' : ''}>
                          <td className="py-2.5 px-2 font-medium">₹{row.fmv}</td>
                          <td className="text-right py-2.5 px-2">{formatCurrencyCompactINR(row.exerciseCost)}</td>
                          <td className="text-right py-2.5 px-2">{formatCurrencyCompactINR(row.perquisiteIncome)}</td>
                          {useAutoTax && (
                            <>
                              <td className="text-right py-2.5 px-2">{formatCurrencyCompactINR(row.totalIncomeAtExercise || 0)}</td>
                              <td className="text-right py-2.5 px-2">{formatPercent(row.marginalTaxRate || 0)}</td>
                              <td className="text-right py-2.5 px-2">{formatPercent(row.surchargeRate || 0)}</td>
                              <td className="text-right py-2.5 px-2">{formatPercent(row.effectiveTaxRate || 0)}</td>
                            </>
                          )}
                          <td className="text-right py-2.5 px-2 text-red-600">{formatCurrencyCompactINR(row.exerciseTax)}</td>
                          <td className="text-right py-2.5 px-2 font-medium">{formatCurrencyCompactINR(row.totalCashOutflow)}</td>
                          <td className="text-right py-2.5 px-2">₹{row.sellingFMV}</td>
                          <td className="text-right py-2.5 px-2">{formatCurrencyCompactINR(row.saleValue)}</td>
                          <td className="text-right py-2.5 px-2">{formatCurrencyCompactINR(row.capitalGain)}</td>
                          <td className="text-right py-2.5 px-2 text-red-600">{formatCurrencyCompactINR(row.ltcgTax)}</td>
                          <td className={`text-right py-2.5 px-2 font-semibold bg-blue-50 ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrencyCompactINR(row.netProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Card */}
          <Card className="mb-6 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="h-5 w-5 text-blue-600" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">{summary}</p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center sticky bottom-4 z-10">
            <Button onClick={handleReset} variant="outline" className="shadow-lg bg-white">
              <RotateCcwIcon className="h-4 w-4 mr-2" />
              Reset to defaults
            </Button>
            <Button onClick={handleCopySummary} variant="outline" className="shadow-lg bg-white">
              <CopyIcon className="h-4 w-4 mr-2" />
              Copy summary
            </Button>
            <Button 
              onClick={handleDownloadCSV} 
              variant="outline" 
              className="shadow-lg bg-white"
              disabled={!showScenarioTable || scenarioRows.length === 0}
            >
              <DownloadIcon className="h-4 w-4 mr-2" />
              Download scenario CSV
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface MetricCardProps {
  label: string;
  value: number;
  tooltip?: string;
  highlighted?: boolean;
  featured?: boolean;
  positive?: boolean;
  negative?: boolean;
  isMultiple?: boolean;
  valueFormatter?: (value: number) => string;
  badge?: string;
}

function MetricCard({ 
  label, 
  value, 
  tooltip, 
  highlighted, 
  featured, 
  positive,
  negative,
  isMultiple,
  valueFormatter,
  badge
}: MetricCardProps) {
  const displayValue = valueFormatter 
    ? valueFormatter(value) 
    : isMultiple 
    ? formatMultiple(value)
    : formatCurrencyCompactINR(value);
  
  const exactValue = isMultiple ? '' : formatCurrencyExactINR(value);

  let cardClass = 'shadow-md hover:shadow-lg transition-shadow';
  let valueClass = 'text-2xl font-bold';

  if (featured) {
    cardClass = 'shadow-xl border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50';
    valueClass = 'text-3xl font-bold';
  } else if (highlighted) {
    cardClass = 'shadow-lg bg-slate-50';
  }

  if (positive) {
    valueClass += ' text-green-600';
  } else if (negative) {
    valueClass += ' text-red-600';
  }

  const content = (
    <Card className={cardClass}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1">
          {label}
          {tooltip && <InfoIcon className="h-3 w-3 text-slate-400" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={valueClass}>{displayValue}</div>
        {exactValue && (
          <div className="text-xs text-slate-500 mt-1">{exactValue}</div>
        )}
        {badge && (
          <Badge variant="outline" className="mt-2 text-xs">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface BreakdownRowProps {
  label: string;
  value: string;
  exact: string;
  highlighted?: boolean;
  featured?: boolean;
  positive?: boolean;
  negative?: boolean;
}

function BreakdownRow({ label, value, exact, highlighted, featured, positive, negative }: BreakdownRowProps) {
  let rowClass = 'py-3 px-4';
  let valueClass = '';

  if (featured) {
    rowClass += ' bg-blue-50 font-semibold';
    valueClass = 'text-lg font-bold';
  } else if (highlighted) {
    rowClass += ' bg-slate-50 font-medium';
  }

  if (positive) {
    valueClass += ' text-green-600';
  } else if (negative) {
    valueClass += ' text-red-600';
  }

  return (
    <tr>
      <td className={rowClass}>{label}</td>
      <td className={`text-right ${rowClass} ${valueClass}`}>{value}</td>
      <td className={`text-right ${rowClass} text-slate-500 text-xs`}>{exact}</td>
    </tr>
  );
}
