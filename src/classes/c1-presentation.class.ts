// THE CLOCK TICKS SHOULD NOT BE HARD VARIABLE

import { Presentation, ResultDTO, Utils, VariableDTO } from "aethon-arion-pipeline";
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

export class C1Presentation extends Presentation {
    reportingVariableEnum = C1ReportingVariables;
    plantStateVariableEnum = C1PlantStateVariables;
    stateCount: number = 0;

    constructor(resultDTO: ResultDTO) {
        super(resultDTO);
        if (this.resultDTO.simConfig && this.resultDTO.simConfig.orgConfig) {
            this.priorityTensor = this.resultDTO.priorityTensor;
            this.targetPriorityTensor = this.resultDTO.simConfig?.orgConfig?.agentSet.priorityTensor;

            this.plantStateVariableArray = C1PlantStateVariablesArray;
            this.reportingVariableArray = C1ReportingVariablesArray;
            this.agentCount = this.resultDTO.simConfig.orgConfig.agentCount;
            this.stateCount = C1AgentStatesArray.length;

            const reporting: number[] = this.resultDTO.reporting;
            const plan: number[] = this.resultDTO.board;
            const plant: number[] = this.resultDTO.plant;

            this.deltaTensor = Utils.tensor(
                [this.agentCount, this.stateCount, this.stateCount],
                () => {
                    return 0;
                }
            ) as number[][][];
            
            this.variables.set(this.reportingVariableEnum.REVENUE, {
                name: this.reportingVariableEnum.REVENUE,
                reporting: reporting[C1ReportingVariablesIndex.REVENUE],
                plan: plan[C1ReportingVariablesIndex.REVENUE]
            });
            this.variables.set(this.reportingVariableEnum.PAYROLL, {
                name: this.reportingVariableEnum.PAYROLL,
                reporting: reporting[C1ReportingVariablesIndex.PAYROLL],
                plan: plan[C1ReportingVariablesIndex.PAYROLL]
            });
            this.variables.set("Operating profit", {
                name: "Gross profit",
                reporting: reporting[C1ReportingVariablesIndex.REVENUE] - reporting[C1ReportingVariablesIndex.PAYROLL],
                plan: plan[C1ReportingVariablesIndex.REVENUE] - plan[C1ReportingVariablesIndex.PAYROLL]
            });
            this.variables.set("Sales volume", {
                name: "Sales volume",
                reporting:
                    (this.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO).reporting /
                    reporting[C1ReportingVariablesIndex.UNIT_PRICE],
                plan:
                    (this.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO).plan /
                    plan[C1ReportingVariablesIndex.UNIT_PRICE]
            });
            this.variables.set(this.reportingVariableEnum.UNIT_PRICE, {
                name: this.reportingVariableEnum.UNIT_PRICE,
                reporting: reporting[C1ReportingVariablesIndex.UNIT_PRICE],
                plan: plan[C1ReportingVariablesIndex.UNIT_PRICE]
            });
            this.variables.set(this.reportingVariableEnum.HEADCOUNT, {
                name: this.reportingVariableEnum.HEADCOUNT,
                reporting: reporting[C1ReportingVariablesIndex.HEADCOUNT],
                plan: plan[C1ReportingVariablesIndex.HEADCOUNT]
            });
            this.variables.set(this.reportingVariableEnum.UNIT_PAYROLL, {
                name: this.reportingVariableEnum.UNIT_PAYROLL,
                reporting: reporting[C1ReportingVariablesIndex.UNIT_PAYROLL],
                plan: plan[C1ReportingVariablesIndex.UNIT_PAYROLL]
            });
            this.variables.set("Clock ticks", {
                name: "Clock ticks",
                reporting: reporting[C1ReportingVariablesIndex.CLOCK_TICKS],
                plan: plan[C1ReportingVariablesIndex.CLOCK_TICKS]
            });
            this.variables.set("Seconds per work month", {
                name: "Seconds per work month",
                reporting: 20 * 8 * 3600,
                plan: 20 * 8 * 3600
            });
            this.variables.set("Clock tick seconds", {
                name: "Clock tick seconds",
                reporting: reporting[C1ReportingVariablesIndex.CLOCK_TICK_SECONDS],
                plan: plan[C1ReportingVariablesIndex.CLOCK_TICK_SECONDS]
            });
            this.variables.set(this.plantStateVariableEnum.ACTION, {
                name: this.plantStateVariableEnum.ACTION,
                reporting: plant[C1PlantStateVariablesIndex.ACTION],
                plan: C1AgentStateIndex.ACTION
            });

            // create the report objects
            this.reports.push({
                name: "P&L",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: this.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO
                    },
                    {
                        class: "",
                        operator: "-",
                        values: this.variables.get(this.reportingVariableEnum.PAYROLL) as VariableDTO
                    },
                    {
                        class: "total",
                        operator: "=",
                        values: this.variables.get("Operating profit") as VariableDTO
                    }
                ]
            });
            this.reports.push({
                name: "Revenue build",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: this.variables.get("Sales volume") as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: this.variables.get(this.reportingVariableEnum.UNIT_PRICE) as VariableDTO
                    },
                    {
                        class: "total",
                        operator: "=",
                        values: this.variables.get(this.reportingVariableEnum.REVENUE) as VariableDTO
                    }
                ]
            });
            this.reports.push({
                name: "Payroll build",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: this.variables.get(this.reportingVariableEnum.HEADCOUNT) as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: this.variables.get(this.reportingVariableEnum.UNIT_PAYROLL) as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#247;",
                        values: this.variables.get("Seconds per work month") as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: this.variables.get("Clock tick seconds") as VariableDTO
                    },
                    {
                        class: "",
                        operator: "&#215;",
                        values: this.variables.get("Clock ticks") as VariableDTO
                    },
                    {
                        class: "total",
                        operator: "=",
                        values: this.variables.get(this.reportingVariableEnum.PAYROLL) as VariableDTO
                    }
                ]
            });
            this.reports.push({
                name: "Plant state",
                lineItems: [
                    {
                        class: "",
                        operator: "",
                        values: this.variables.get(this.plantStateVariableEnum.ACTION) as VariableDTO
                    }
                ]
            });

            // initialise deltaTensor
            for (let alpha = 0; alpha < this.agentCount; alpha++) {
                for (let sigma = 0; sigma < this.stateCount; sigma++) {
                    for (let tau = 0; tau < this.stateCount; tau++) {
                        this.deltaTensor[alpha][sigma][tau] =
                            this.priorityTensor[alpha][sigma][tau] - this.targetPriorityTensor[alpha][sigma][tau]
                    }
                }
            }
        }
    }
}
