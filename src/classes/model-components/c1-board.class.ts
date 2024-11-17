import { Board, Targets, Logger, OrgModelConfig } from "aethon-arion-pipeline";
import { C1PlantStateIdle, C1PlantStateTarget, C1ReportingVariablesIndex } from "../../constants/c1.model.constants";
import { C1BoardConfig } from "../../interfaces/c1.interfaces";

export class C1Board extends Board {
    private _config: C1BoardConfig;
    private _controlStep: boolean;
    private _stepPlans: {
        before: Targets;
        after: Targets;
    };
    private _stepExecuted: boolean;
    private _totalClockTicks: number;

    constructor(config: OrgModelConfig, clockTicks: number, reporting: number[], logger: Logger) {
        super({} as Targets, logger);
        this._log("Initialising C1 Board");
        this._config = config.board as C1BoardConfig;
        this._controlStep = this._config.controlStep;
        this._stepExecuted = false;
        this._totalClockTicks = clockTicks;
        const targetFinancialsAfter = JSON.parse(JSON.stringify(reporting));
        const targetPlantStateAfter: number[] = C1PlantStateTarget;

        // calculate the target revenue, payroll and net income after the step, if applicable
        targetFinancialsAfter[C1ReportingVariablesIndex.REVENUE] =
            targetFinancialsAfter[C1ReportingVariablesIndex.HEADCOUNT] *
            targetFinancialsAfter[C1ReportingVariablesIndex.UNIT_PRICE] *
            this._totalClockTicks;

        targetFinancialsAfter[C1ReportingVariablesIndex.PAYROLL] =
            targetFinancialsAfter[C1ReportingVariablesIndex.HEADCOUNT] *
            targetFinancialsAfter[C1ReportingVariablesIndex.UNIT_PAYROLL] *
            this._totalClockTicks;

        targetFinancialsAfter[C1ReportingVariablesIndex.NET_INCOME] =
            targetFinancialsAfter[C1ReportingVariablesIndex.REVENUE] -
            targetFinancialsAfter[C1ReportingVariablesIndex.PAYROLL];

        targetFinancialsAfter[C1ReportingVariablesIndex.CLOCK_TICKS] = this._totalClockTicks;

        this._stepPlans = {
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
        if (this._controlStep) {
            const targetFinancialsBefore = JSON.parse(JSON.stringify(reporting));
            const targetPlantStateBefore: number[] = C1PlantStateIdle;
            targetFinancialsBefore[C1ReportingVariablesIndex.REVENUE] = 0;
            targetFinancialsBefore[C1ReportingVariablesIndex.PAYROLL] =
                targetFinancialsAfter[C1ReportingVariablesIndex.PAYROLL];
            targetFinancialsBefore[C1ReportingVariablesIndex.NET_INCOME] =
                targetFinancialsBefore[C1ReportingVariablesIndex.REVENUE] -
                targetFinancialsBefore[C1ReportingVariablesIndex.PAYROLL];
            targetFinancialsBefore[C1ReportingVariablesIndex.CLOCK_TICKS] = this._totalClockTicks;
            this._stepPlans.before = {
                plantState: targetPlantStateBefore,
                reporting: targetFinancialsBefore
            };
        }

        // initialise the plan tensor with the target plant state and reporting results at the initial state (before any step)
        this.plan = this._stepPlans.before;
        this._log("C1 Board initialised", { targets: this.plan });
        return this;
    }

    transitionState(reportingTensor: number[]): Targets {
        // check if we are halfway through the simulation and if we need to switch the control step
        this._log("Transitioning C1 Board state");
        if (
            !this._stepExecuted &&
            reportingTensor[C1ReportingVariablesIndex.CLOCK_TICKS] >= this._totalClockTicks / 2
        ) {
            this.plan = this._stepPlans.after; // switch the plan to the after step
            this._stepExecuted = true; // mark the signal step as executed
        }
        // broadcast the Board plan
        this._log("C1 Board state transitioned", { plan: this.plan });
        return this.plan;
    }
}
