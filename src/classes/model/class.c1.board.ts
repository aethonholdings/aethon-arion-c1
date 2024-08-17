import { Board, Targets, Logger } from "aethon-arion-pipeline";
import { C1PlantStateTarget, C1ReportingVariablesIndex } from "../../constants/c1.model.constants";

export class C1Board extends Board {
    constructor(clockTicks: number, reporting: number[], logger: Logger) {
        super({} as Targets, logger);
        this._log("Initialising C1 Board");
        const targetFinancials = JSON.parse(JSON.stringify(reporting));
        const targetPlantState: number[] = C1PlantStateTarget;

        targetFinancials[C1ReportingVariablesIndex.REVENUE] =
            (targetFinancials[C1ReportingVariablesIndex.HEADCOUNT] *
                targetFinancials[C1ReportingVariablesIndex.UNIT_PRICE] *
                clockTicks) /
            2;

        targetFinancials[C1ReportingVariablesIndex.PAYROLL] =
            (targetFinancials[C1ReportingVariablesIndex.HEADCOUNT] *
                targetFinancials[C1ReportingVariablesIndex.UNIT_PAYROLL] *
                clockTicks) /
            2;

        targetFinancials[C1ReportingVariablesIndex.NET_INCOME] =
            targetFinancials[C1ReportingVariablesIndex.REVENUE] - targetFinancials[C1ReportingVariablesIndex.PAYROLL];

        targetFinancials[C1ReportingVariablesIndex.CLOCK_TICKS] = clockTicks;

        this.plan = {
            plantState: targetPlantState,
            reporting: targetFinancials
        };
        this._log("C1 Board initialised", { targets: this.plan });
        return this;
    }

    transitionState(reportingTensor: number[]): Targets {
        if(this.plan.reporting[C1ReportingVariablesIndex.CLOCK_TICKS] >= this.plan.reporting[C1ReportingVariablesIndex.CLOCK_TICKS]/2) {
            this.plan.plantState = [0];
        }
        this._log("Transitioning C1 Board state", { reporting: this.plan.reporting });
        this._log("C1 Board state transitioned", { reporting: this.plan.reporting });
        return this.plan;
    }
}
