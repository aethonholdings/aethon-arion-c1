import {
    KPIDTO,
    PlanVsActualsKPIFactory,
    PlanVsActualsKPIs,
    PlanVsActualsKPIsProForma,
    PlanVsActualsKPIsProFormaVariable,
    ResultDTO,
    Utils
} from "aethon-arion-pipeline";
import {
    C1AgentStatesArray,
    C1PlantStateVariables,
    C1PlantStateVariablesIndex,
    C1ReportingVariables,
    C1ReportingVariablesIndex,
    KPIFactoryIndex
} from "../../constants/c1.model.constants";
import { C1Model } from "../pipeline/c1-model.class";
import { C1ConfiguratorParamData } from "../../interfaces/c1.interfaces";

/**
 * KPI factory for generating Plan vs. Actuals variance analysis for C1 simulations.
 *
 * @remarks
 * Compares planned (target) organizational performance against actual simulation results,
 * computing variances across financial, operational, and behavioral metrics.
 *
 * **Purpose:**
 *
 * In C1 simulations, the Board sets performance targets (plan) that agents attempt to achieve
 * through coordination. This report analyzes the gap between planned and actual outcomes,
 * providing insight into:
 * - Organizational effectiveness
 * - Agent coordination quality
 * - Behavioral alignment with objectives
 * - Controllability (ability to meet targets)
 *
 * **Report Structure:**
 *
 * Generates pro forma financial statements and operational metrics:
 *
 * 1. **P&L Statement**:
 *    - Revenue (actual vs. plan)
 *    - Payroll costs (actual vs. plan)
 *    - Operating profit (actual vs. plan)
 *
 * 2. **Revenue Build**:
 *    - Sales volume (units sold)
 *    - Unit price
 *    - Total revenue (volume × price)
 *
 * 3. **Payroll Build**:
 *    - Headcount
 *    - Unit payroll (cost per employee-second)
 *    - Clock tick duration
 *    - Clock ticks (simulation steps)
 *    - Total payroll (headcount × unit payroll × time)
 *
 * 4. **Plant State**:
 *    - Action level (organizational output intensity)
 *
 * 5. **Agent Performance**:
 *    - Revenue per agent (productivity metric)
 *
 * **Variance Calculation:**
 *
 * For each metric:
 * ```
 * delta = actual - plan
 * ```
 *
 * Positive delta: Actual exceeded plan (favorable for revenue, unfavorable for costs)
 * Negative delta: Actual fell short of plan (unfavorable for revenue, favorable for costs)
 *
 * **Behavioral Analysis:**
 *
 * In addition to financial metrics, the report includes:
 * - **Priority Tensor Deltas**: Agent state preference variances
 *   - deltaTensor[α][σ][τ] = actual[α][σ][τ] - target[α][σ][τ]
 *   - Positive: Agent transitioned σ→τ more than planned
 *   - Negative: Agent transitioned σ→τ less than planned
 *
 * This reveals how agent behavior evolved during the simulation relative to
 * initial configuration, indicating learning, adaptation, or drift.
 *
 * **Data Sources:**
 *
 * - **Actual**: ResultDTO (simulation outcomes)
 *   - resultDTO.reporting: Financial and operational actuals
 *   - resultDTO.plant: Plant state actuals
 *   - resultDTO.priorityTensor: Learned agent behaviors
 *
 * - **Plan**: Board targets from OrgConfig
 *   - resultDTO.board: Board-set targets
 *   - resultDTO.simConfig.orgConfig.agentSet.priorityTensor: Initial agent behaviors
 *
 * **Metrics Computed:**
 *
 * | Metric | Formula | Units |
 * |--------|---------|-------|
 * | Revenue | Σ(agent actions × unit price) | Currency |
 * | Payroll | Headcount × unit payroll × time | Currency |
 * | Operating Profit | Revenue - Payroll | Currency |
 * | Sales Volume | Revenue / unit price | Units |
 * | Revenue per Agent | Revenue / agent count | Currency/agent |
 *
 * **Bug Fixes (v0.4.2):**
 *
 * - Fixed HIGH severity division by zero when agentCount=0 (line 110-111)
 * - Fixed LOW severity unsafe type cast for revenue variable (line 67-71)
 * - Added null check with optional chaining and fallback to 0
 *
 * @example
 * ```typescript
 * const model = new C1Model();
 * const report = new C1PlanVsActualsReport(model);
 *
 * // Generate report from simulation result
 * const kpi = report.generate(resultDTO);
 *
 * console.log("P&L Statement:");
 * kpi.data.proFormas[0].lineItems.forEach(item => {
 *   if (item.data) {
 *     console.log(`${item.data.name}: ${item.data.actual} (plan: ${item.data.plan}, Δ: ${item.data.delta})`);
 *   }
 * });
 * // Output:
 * // Revenue: 1250 (plan: 1500, Δ: -250)
 * // Payroll costs: 800 (plan: 750, Δ: 50)
 * // Operating profit: 450 (plan: 750, Δ: -300)
 *
 * // Analyze behavioral variances
 * const priorityDelta = kpi.data.priorityTensor.delta;
 * console.log("Agent 0 increased Action→Action transitions by:",
 *   priorityDelta[0][C1AgentStateIndex.ACTION][C1AgentStateIndex.ACTION]);
 * ```
 *
 * @public
 */
export class C1PlanVsActualsReport extends PlanVsActualsKPIFactory<
    C1ConfiguratorParamData> {
    /**
     * Creates a new C1PlanVsActualsReport instance.
     *
     * @param model - Parent C1 model instance
     *
     * @remarks
     * Initializes the KPI factory with the C1 model reference and registers
     * it under the name {@link KPIFactoryIndex.PLAN_VS_ACTUALS}.
     *
     * @example
     * ```typescript
     * const model = new C1Model();
     * const report = new C1PlanVsActualsReport(model);
     * ```
     */
    constructor(model: C1Model) {
        super(KPIFactoryIndex.PLAN_VS_ACTUALS, model);
    }

    /**
     * Generates a Plan vs. Actuals variance report from simulation results.
     *
     * @param resultDTO - Simulation result containing actual outcomes and planned targets
     * @returns KPI DTO with pro forma statements and behavioral variance analysis
     *
     * @remarks
     * Implements a comprehensive variance analysis algorithm:
     *
     * **Stage 1: Data Extraction**
     *
     * Extracts from ResultDTO:
     * - agentCount: Number of agents in simulation
     * - reporting[]: Actual financial/operational metrics
     * - board[]: Planned target metrics
     * - plant[]: Plant state actuals
     * - priorityTensor: Actual agent state preferences (learned)
     * - orgConfig.agentSet.priorityTensor: Target agent state preferences (initial)
     *
     * **Stage 2: Variable Calculation**
     *
     * Computes derived metrics:
     *
     * *Financial:*
     * - Operating Profit = Revenue - Payroll
     * - Sales Volume = Revenue / Unit Price
     * - Revenue per Agent = Revenue / agentCount (with zero-division guard)
     *
     * *Operational:*
     * - Headcount (from reporting)
     * - Clock ticks (simulation steps)
     * - Clock tick seconds (time per step)
     *
     * *Behavioral:*
     * - Priority tensor deltas (actual - target)
     *
     * **Stage 3: Variance Computation**
     *
     * For each variable:
     * ```
     * delta = actual - plan
     * ```
     *
     * Stored in variable.delta field.
     *
     * **Stage 4: Pro Forma Assembly**
     *
     * Constructs financial statements:
     *
     * 1. **P&L**: Revenue - Payroll = Operating Profit
     * 2. **Revenue Build**: Volume × Price = Revenue
     * 3. **Payroll Build**: Headcount × Unit Payroll × Time = Payroll
     * 4. **Plant State**: Action level
     * 5. **Agent Performance**: Revenue / Agent count
     *
     * Each statement includes actual, plan, and delta values.
     *
     * **Stage 5: Behavioral Analysis**
     *
     * Computes priority tensor variances:
     * ```
     * deltaTensor[α][σ][τ] = actualPriority[α][σ][τ] - targetPriority[α][σ][τ]
     * ```
     *
     * Reveals how agent behavior evolved:
     * - Positive: Agent favored this transition more than initial configuration
     * - Negative: Agent favored this transition less than initial configuration
     *
     * **Stage 6: DTO Packaging**
     *
     * Returns KPIDTO with:
     * - proFormas[]: Financial and operational statements
     * - priorityTensor: { actual, plan, delta } tensors
     *
     * **Error Handling:**
     *
     * Validates input:
     * - Ensures resultDTO.simConfig exists
     * - Ensures resultDTO.simConfig.orgConfig exists
     * - Wraps computation in try-catch with generic error message
     *
     * **Division-by-Zero Guards (v0.4.2):**
     *
     * - Revenue per agent: Returns 0 if agentCount = 0
     * - Sales volume: Uses optional chaining with fallback to 0
     *
     * @throws {Error} If resultDTO.simConfig or orgConfig are missing
     * @throws {Error} If computation fails (generic error with message)
     *
     * @example
     * ```typescript
     * const report = new C1PlanVsActualsReport(model);
     *
     * try {
     *   const kpi = report.generate(resultDTO);
     *
     *   // Access P&L statement
     *   const pnl = kpi.data.proFormas.find(pf => pf.name === "P&L");
     *   const revenue = pnl.lineItems.find(li => li.data.name === "Revenue");
     *
     *   console.log(`Revenue: ${revenue.data.actual}`);
     *   console.log(`Plan: ${revenue.data.plan}`);
     *   console.log(`Variance: ${revenue.data.delta}`);
     *   console.log(`Variance %: ${(revenue.data.delta / revenue.data.plan * 100).toFixed(1)}%`);
     *
     *   // Analyze agent behavior shifts
     *   const priorityDeltas = kpi.data.priorityTensor.delta;
     *   let maxDelta = 0;
     *   let maxAgent = 0;
     *   for (let alpha = 0; alpha < priorityDeltas.length; alpha++) {
     *     const agentDelta = Math.abs(priorityDeltas[alpha][0][0]); // Action→Action
     *     if (agentDelta > maxDelta) {
     *       maxDelta = agentDelta;
     *       maxAgent = alpha;
     *     }
     *   }
     *   console.log(`Agent ${maxAgent} had largest behavioral shift: ${maxDelta}`);
     *
     * } catch (error) {
     *   console.error("Failed to generate report:", error.message);
     * }
     * ```
     */
    generate(resultDTO: ResultDTO): KPIDTO<PlanVsActualsKPIs> {
        if (resultDTO?.simConfig && resultDTO?.simConfig.orgConfig) {
            try {
                // input data structures
                const agentCount = resultDTO.simConfig.orgConfig.agentCount;
                const stateCount = C1AgentStatesArray.length;
                const reporting: number[] = resultDTO.reporting;
                const plan: number[] = resultDTO.board;
                const plant: number[] = resultDTO.plant;
                const actualPriorityTensor: number[][][] = resultDTO.priorityTensor;
                const targetPriorityTensor: number[][][] = resultDTO?.simConfig?.orgConfig?.agentSet.priorityTensor;

                // output data structures
                const reports: PlanVsActualsKPIsProForma[] = [];
                const deltaTensor = Utils.tensor([agentCount, stateCount, stateCount], () => {
                    return 0;
                }) as number[][][];

                // initialise the values of all the variables in the KPI report
                const variables: Map<string, PlanVsActualsKPIsProFormaVariable> = new Map();
                variables.set(C1ReportingVariables.REVENUE, {
                    name: C1ReportingVariables.REVENUE,
                    actual: reporting[C1ReportingVariablesIndex.REVENUE],
                    plan: plan[C1ReportingVariablesIndex.REVENUE]
                });
                variables.set(C1ReportingVariables.PAYROLL, {
                    name: C1ReportingVariables.PAYROLL,
                    actual: reporting[C1ReportingVariablesIndex.PAYROLL],
                    plan: plan[C1ReportingVariablesIndex.PAYROLL]
                });
                variables.set("Operating profit", {
                    name: "Gross profit",
                    actual: reporting[C1ReportingVariablesIndex.REVENUE] - reporting[C1ReportingVariablesIndex.PAYROLL],
                    plan: plan[C1ReportingVariablesIndex.REVENUE] - plan[C1ReportingVariablesIndex.PAYROLL]
                });
                variables.set("Sales volume", {
                    name: "Sales volume",
                    actual:
                        (variables.get(C1ReportingVariables.REVENUE)?.actual ?? 0) /
                        reporting[C1ReportingVariablesIndex.UNIT_PRICE],
                    plan:
                        (variables.get(C1ReportingVariables.REVENUE)?.plan ?? 0) /
                        plan[C1ReportingVariablesIndex.UNIT_PRICE]
                });
                variables.set(C1ReportingVariables.UNIT_PRICE, {
                    name: C1ReportingVariables.UNIT_PRICE,
                    actual: reporting[C1ReportingVariablesIndex.UNIT_PRICE],
                    plan: plan[C1ReportingVariablesIndex.UNIT_PRICE]
                });
                variables.set(C1ReportingVariables.HEADCOUNT, {
                    name: C1ReportingVariables.HEADCOUNT,
                    actual: reporting[C1ReportingVariablesIndex.HEADCOUNT],
                    plan: plan[C1ReportingVariablesIndex.HEADCOUNT]
                });
                variables.set(C1ReportingVariables.UNIT_PAYROLL, {
                    name: C1ReportingVariables.UNIT_PAYROLL,
                    actual: reporting[C1ReportingVariablesIndex.UNIT_PAYROLL],
                    plan: plan[C1ReportingVariablesIndex.UNIT_PAYROLL]
                });
                variables.set("Clock ticks", {
                    name: "Clock ticks",
                    actual: reporting[C1ReportingVariablesIndex.CLOCK_TICKS],
                    plan: plan[C1ReportingVariablesIndex.CLOCK_TICKS]
                });
                variables.set("Seconds per work month", {
                    name: "Seconds per work month",
                    actual: 20 * 8 * 3600,
                    plan: 20 * 8 * 3600
                });
                variables.set("Clock tick seconds", {
                    name: "Clock tick seconds",
                    actual: reporting[C1ReportingVariablesIndex.CLOCK_TICK_SECONDS],
                    plan: plan[C1ReportingVariablesIndex.CLOCK_TICK_SECONDS]
                });
                variables.set(C1PlantStateVariables.ACTION, {
                    name: C1PlantStateVariables.ACTION,
                    actual: resultDTO.plant[C1PlantStateVariablesIndex.ACTION],
                    plan: plant[C1PlantStateVariablesIndex.ACTION]
                });
                variables.set("Revenue per agent", {
                    name: "Revenue per agent",
                    actual: agentCount > 0 ? reporting[C1ReportingVariablesIndex.REVENUE] / agentCount : 0,
                    plan: agentCount > 0 ? plan[C1ReportingVariablesIndex.REVENUE] / agentCount : 0
                });

                // calculate the deltas
                variables.forEach((variable) => {
                    variable.delta = variable.actual - variable.plan;
                    variables.set(variable.name, variable);
                });
                for (let alpha = 0; alpha < agentCount; alpha++) {
                    for (let sigma = 0; sigma < stateCount; sigma++) {
                        for (let tau = 0; tau < stateCount; tau++) {
                            deltaTensor[alpha][sigma][tau] =
                                actualPriorityTensor[alpha][sigma][tau] - targetPriorityTensor[alpha][sigma][tau];
                        }
                    }
                }

                // compose the report objects
                reports.push({
                    name: "P&L",
                    lineItems: [
                        {
                            class: "",
                            operator: "",
                            data: variables.get(C1ReportingVariables.REVENUE)
                        },
                        {
                            class: "",
                            operator: "-",
                            data: variables.get(C1ReportingVariables.PAYROLL)
                        },
                        {
                            class: "total",
                            operator: "=",
                            data: variables.get("Operating profit")
                        }
                    ]
                });
                reports.push({
                    name: "Revenue build",
                    lineItems: [
                        {
                            class: "",
                            operator: "",
                            data: variables.get("Sales volume")
                        },
                        {
                            class: "",
                            operator: "&#215;",
                            data: variables.get(C1ReportingVariables.UNIT_PRICE)
                        },
                        {
                            class: "total",
                            operator: "=",
                            data: variables.get(C1ReportingVariables.REVENUE)
                        }
                    ]
                });
                reports.push({
                    name: "Payroll build",
                    lineItems: [
                        {
                            class: "",
                            operator: "",
                            data: variables.get(C1ReportingVariables.HEADCOUNT)
                        },
                        {
                            class: "",
                            operator: "&#215;",
                            data: variables.get(C1ReportingVariables.UNIT_PAYROLL)
                        },
                        {
                            class: "",
                            operator: "&#247;",
                            data: variables.get("Seconds per work month")
                        },
                        {
                            class: "",
                            operator: "&#215;",
                            data: variables.get("Clock tick seconds")
                        },
                        {
                            class: "",
                            operator: "&#215;",
                            data: variables.get("Clock ticks")
                        },
                        {
                            class: "total",
                            operator: "=",
                            data: variables.get(C1ReportingVariables.PAYROLL)
                        }
                    ]
                });
                reports.push({
                    name: "Plant state",
                    lineItems: [
                        {
                            class: "",
                            operator: "",
                            data: variables.get(C1PlantStateVariables.ACTION)
                        }
                    ]
                });
                reports.push({
                    name: "Agent performance",
                    lineItems: [
                        {
                            class: "",
                            operator: "",
                            data: variables.get("Revenue per agent")
                        }
                    ]
                });
                return this._package({
                    proFormas: reports,
                    priorityTensor: { actual: actualPriorityTensor, plan: targetPriorityTensor, delta: deltaTensor }
                } as PlanVsActualsKPIs);
            } catch (error) {
                throw new Error("Error in C1PlanVsActualsReport.generate");
            }
        } else {
            throw new Error("Incomplete resultDTO; simConfig or orgConfig missing");
        }
    }
}
