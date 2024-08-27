import { Board, Targets, Logger } from "aethon-arion-pipeline";
import {
    C1PlantStateIdle,
    C1PlantStateTarget,
    C1ReportingVariablesIndex
} from "../../constants/c1.model.constants";
import { C1OrgModelConfig } from "../../interfaces/c1.model.interfaces";

export class C1Board extends Board {
    controlStep: boolean;
    stepPlans: {
        before: Targets;
        after: Targets;
    };

    constructor(config: C1OrgModelConfig, clockTicks: number, reporting: number[], logger: Logger) {
        super({} as Targets, logger);
        this._log("Initialising C1 Board");
        this.controlStep = config.board.controlStep;
        const targetFinancialsAfter = JSON.parse(JSON.stringify(reporting));
        const targetPlantStateAfter: number[] = C1PlantStateTarget;

        // calculate the target revenue, payroll and net income after the step, if applicable
        targetFinancialsAfter[C1ReportingVariablesIndex.REVENUE] =
            (targetFinancialsAfter[C1ReportingVariablesIndex.HEADCOUNT] *
                targetFinancialsAfter[C1ReportingVariablesIndex.UNIT_PRICE] *
                clockTicks);

        targetFinancialsAfter[C1ReportingVariablesIndex.PAYROLL] =
            targetFinancialsAfter[C1ReportingVariablesIndex.HEADCOUNT] *
            targetFinancialsAfter[C1ReportingVariablesIndex.UNIT_PAYROLL] *
            clockTicks;

        targetFinancialsAfter[C1ReportingVariablesIndex.NET_INCOME] =
            targetFinancialsAfter[C1ReportingVariablesIndex.REVENUE] -
            targetFinancialsAfter[C1ReportingVariablesIndex.PAYROLL];

        targetFinancialsAfter[C1ReportingVariablesIndex.CLOCK_TICKS] = clockTicks;

        this.stepPlans = {
            before: {
                plantState: targetPlantStateAfter,
                reporting: targetFinancialsAfter
            },
            after: {
                plantState: targetPlantStateAfter,
                reporting: targetFinancialsAfter
            }
        };
        // calculate the target revenue, payroll and net income before the step, if applicable
        if (this.controlStep) {
            const targetFinancialsBefore = JSON.parse(JSON.stringify(reporting));
            const targetPlantStateBefore: number[] = C1PlantStateIdle;
            targetFinancialsBefore[C1ReportingVariablesIndex.REVENUE] = 0;
            targetFinancialsBefore[C1ReportingVariablesIndex.PAYROLL] =
                targetFinancialsAfter[C1ReportingVariablesIndex.PAYROLL];
            targetFinancialsBefore[C1ReportingVariablesIndex.NET_INCOME] =
                targetFinancialsBefore[C1ReportingVariablesIndex.REVENUE] -
                targetFinancialsBefore[C1ReportingVariablesIndex.PAYROLL];
            targetFinancialsBefore[C1ReportingVariablesIndex.CLOCK_TICKS] = clockTicks; 
            this.stepPlans.before = {
                plantState: targetPlantStateBefore,
                reporting: targetFinancialsBefore
            };
        }

        // initialise the plan tensor with the target plant state and reporting results at the initial state (before any step)
        this.plan = this.stepPlans.before;
        this._log("C1 Board initialised", { targets: this.plan });
        return this;
    }

    transitionState(reportingTensor: number[]): Targets {
        // check if we are halfway through the simulation and if we need to switch the control step
        if (
            this.controlStep &&
            this.plan.reporting[C1ReportingVariablesIndex.CLOCK_TICKS] >=
                this.plan.reporting[C1ReportingVariablesIndex.CLOCK_TICKS] / 2
        ) {
            this.plan = this.stepPlans.after;   // switch the plan to the after step
        }
        // broadcast the Board plan
        this._log("Transitioning C1 Board state", { plan: this.plan });
        this._log("C1 Board state transitioned", { plan: this.plan });
        return this.plan;
    }
}
