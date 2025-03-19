import {
    GradientAscentParameterDTO,
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
import { C1ConfiguratorParamData, C1OptimiserData, C1ParamSpaceDefinition } from "../../interfaces/c1.interfaces";

export class C1PlanVsActualsReport extends PlanVsActualsKPIFactory<C1ConfiguratorParamData, GradientAscentParameterDTO<C1ParamSpaceDefinition>, C1OptimiserData> {
    constructor(model: C1Model) {
        super(KPIFactoryIndex.PLAN_VS_ACTUALS, model);
    }

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
                        (variables.get(C1ReportingVariables.REVENUE) as PlanVsActualsKPIsProFormaVariable).actual /
                        reporting[C1ReportingVariablesIndex.UNIT_PRICE],
                    plan:
                        (variables.get(C1ReportingVariables.REVENUE) as PlanVsActualsKPIsProFormaVariable).plan /
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
                    actual: reporting[C1ReportingVariablesIndex.REVENUE]  / agentCount,
                    plan: plan[C1ReportingVariablesIndex.REVENUE] / agentCount
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
                    ]});
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
