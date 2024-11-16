import { Result, ResultReportDTO, Utils, VariableDTO } from "aethon-arion-pipeline";
import {
    C1AgentStateIndex,
    C1AgentStatesArray,
    C1PlantStateVariables,
    C1PlantStateVariablesArray,
    C1PlantStateVariablesIndex,
    C1ReportingVariables,
    C1ReportingVariablesArray,
    C1ReportingVariablesIndex
} from "../constants/c1.model.constants";

export class C1Result extends Result {
    reportingVariableEnum = C1ReportingVariables;
    plantStateVariableEnum = C1PlantStateVariables;
    stateCount: number = 0;

    getPerformance(): number {
        const headcount = this.reporting[C1ReportingVariablesIndex.HEADCOUNT];
        const revenue = this.reporting[C1ReportingVariablesIndex.REVENUE];
        return revenue / headcount;
    }

    getResultReport(): ResultReportDTO {
        const reportDTO: ResultReportDTO = {
            variables: new Map<string, VariableDTO>(),
            reports: [],
            reportingVariableArray: [],
            plantStateVariableArray: [],
            targetPriorityTensor: [],
            deltaTensor: []
        };

        if (this.simConfig && this.simConfig.orgConfig) {
            reportDTO.targetPriorityTensor = this.simConfig?.orgConfig?.agentSet.priorityTensor;
            reportDTO.plantStateVariableArray = C1PlantStateVariablesArray;
            reportDTO.reportingVariableArray = C1ReportingVariablesArray;
            this.agentCount = this.simConfig.orgConfig.agentCount;
            this.stateCount = C1AgentStatesArray.length;

            const reporting: number[] = this.reporting;
            const plan: number[] = this.board;
            const plant: number[] = this.plant;

            reportDTO.deltaTensor = Utils.tensor([this.agentCount, this.stateCount, this.stateCount], () => {
                return 0;
            }) as number[][][];

            reportDTO.variables.set(this.reportingVariableEnum.REVENUE, {
                name: this.reportingVariableEnum.REVENUE,
                reporting: reporting[C1ReportingVariablesIndex.REVENUE],
                plan: plan[C1ReportingVariablesIndex.REVENUE]
            });
            reportDTO.variables.set(this.reportingVariableEnum.PAYROLL, {
                name: this.reportingVariableEnum.PAYROLL,
                reporting: reporting[C1ReportingVariablesIndex.PAYROLL],
                plan: plan[C1ReportingVariablesIndex.PAYROLL]
            });
            reportDTO.variables.set("Operating profit", {
                name: "Gross profit",
                reporting: reporting[C1ReportingVariablesIndex.REVENUE] - reporting[C1ReportingVariablesIndex.PAYROLL],
                plan: plan[C1ReportingVariablesIndex.REVENUE] - plan[C1ReportingVariablesIndex.PAYROLL]
            });
            reportDTO.variables.set("Sales volume", {
                name: "Sales volume",
                reporting:
                    (reportDTO.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO).reporting /
                    reporting[C1ReportingVariablesIndex.UNIT_PRICE],
                plan:
                    (reportDTO.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO).plan /
                    plan[C1ReportingVariablesIndex.UNIT_PRICE]
            });
            reportDTO.variables.set(this.reportingVariableEnum.UNIT_PRICE, {
                name: this.reportingVariableEnum.UNIT_PRICE,
                reporting: reporting[C1ReportingVariablesIndex.UNIT_PRICE],
                plan: plan[C1ReportingVariablesIndex.UNIT_PRICE]
            });
            reportDTO.variables.set(this.reportingVariableEnum.HEADCOUNT, {
                name: this.reportingVariableEnum.HEADCOUNT,
                reporting: reporting[C1ReportingVariablesIndex.HEADCOUNT],
                plan: plan[C1ReportingVariablesIndex.HEADCOUNT]
            });
            reportDTO.variables.set(this.reportingVariableEnum.UNIT_PAYROLL, {
                name: this.reportingVariableEnum.UNIT_PAYROLL,
                reporting: reporting[C1ReportingVariablesIndex.UNIT_PAYROLL],
                plan: plan[C1ReportingVariablesIndex.UNIT_PAYROLL]
            });
            reportDTO.variables.set("Clock ticks", {
                name: "Clock ticks",
                reporting: reporting[C1ReportingVariablesIndex.CLOCK_TICKS],
                plan: plan[C1ReportingVariablesIndex.CLOCK_TICKS]
            });
            reportDTO.variables.set("Seconds per work month", {
                name: "Seconds per work month",
                reporting: 20 * 8 * 3600,
                plan: 20 * 8 * 3600
            });
            reportDTO.variables.set("Clock tick seconds", {
                name: "Clock tick seconds",
                reporting: reporting[C1ReportingVariablesIndex.CLOCK_TICK_SECONDS],
                plan: plan[C1ReportingVariablesIndex.CLOCK_TICK_SECONDS]
            });
            reportDTO.variables.set(this.plantStateVariableEnum.ACTION, {
                name: this.plantStateVariableEnum.ACTION,
                reporting: plant[C1PlantStateVariablesIndex.ACTION],
                plan: C1AgentStateIndex.ACTION
            });

            // create the report objects
            reportDTO.reports.push({
                name: "P&L",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: reportDTO.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO
                    },
                    {
                        class: "",
                        operator: "-",
                        values: reportDTO.variables.get(this.reportingVariableEnum.PAYROLL) as VariableDTO
                    },
                    {
                        class: "total",
                        operator: "=",
                        values: reportDTO.variables.get("Operating profit") as VariableDTO
                    }
                ]
            });
            reportDTO.reports.push({
                name: "Revenue build",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: reportDTO.variables.get("Sales volume") as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: reportDTO.variables.get(this.reportingVariableEnum.UNIT_PRICE) as VariableDTO
                    },
                    {
                        class: "total",
                        operator: "=",
                        values: reportDTO.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO
                    }
                ]
            });
            reportDTO.reports.push({
                name: "Payroll build",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: reportDTO.variables.get(this.reportingVariableEnum.HEADCOUNT) as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: reportDTO.variables.get(this.reportingVariableEnum.UNIT_PAYROLL) as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#247;",
                        values: reportDTO.variables.get("Seconds per work month") as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: reportDTO.variables.get("Clock tick seconds") as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: reportDTO.variables.get("Clock ticks") as VariableDTO
                    },
                    {
                        class: "total",
                        operator: "=",
                        values: reportDTO.variables.get(this.reportingVariableEnum.PAYROLL) as VariableDTO
                    }
                ]
            });
            reportDTO.reports.push({
                name: "Plant state",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: reportDTO.variables.get(this.plantStateVariableEnum.ACTION) as VariableDTO
                    }
                ]
            });

            // initialise deltaTensor
            for (let alpha = 0; alpha < this.agentCount; alpha++) {
                for (let sigma = 0; sigma < this.stateCount; sigma++) {
                    for (let tau = 0; tau < this.stateCount; tau++) {
                        reportDTO.deltaTensor[alpha][sigma][tau] =
                            this.priorityTensor[alpha][sigma][tau] - reportDTO.targetPriorityTensor[alpha][sigma][tau];
                    }
                }
            }
        }
        return reportDTO;
    }
}
