import { Logger, Reporting } from "aethon-arion-pipeline";
import {
    C1PlantStateVariablesIndex,
    C1ReportingVariablesArray,
    C1ReportingVariablesIndex
} from "../../constants/c1.model.constants";
import { C1OrgModelConfig } from "../../interfaces/c1.model.interfaces";

export class C1Reporting extends Reporting {
    constructor(config: C1OrgModelConfig, logger: Logger) {
        // initialise the reporting vector
        logger.trace({ sourceObject: "Reporting", message: "Initialising C1 Reporting" });
        const initialReportingVector: number[] = new Array<number>(C1ReportingVariablesArray.length).fill(0);
        initialReportingVector[C1ReportingVariablesIndex.CLOCK_TICK_SECONDS] = config.clockTickSeconds;
        initialReportingVector[C1ReportingVariablesIndex.HEADCOUNT] = config.agentSet.judgmentTensor.length;
        initialReportingVector[C1ReportingVariablesIndex.UNIT_PAYROLL] = config.reporting.unitPayroll;
        initialReportingVector[C1ReportingVariablesIndex.UNIT_PRICE] = config.reporting.unitPrice;
        super(initialReportingVector, logger);
        this._log("C1 Reporting initialised", { reportingTensor: this.reportingTensor });
        return this;
    }

    transitionState(stateTensor: number[], deltaStateTensor: number[], controlInputTensor: number[][]): number[] {
        this._log("Transitioning C1 reporting system");
        // update the reporting vector
        // calculate the revenue
        if (stateTensor[C1PlantStateVariablesIndex.ACTION] === 1) {
            this.reportingTensor[C1ReportingVariablesIndex.REVENUE] =
                this.reportingTensor[C1ReportingVariablesIndex.REVENUE] +
                this.reportingTensor[C1ReportingVariablesIndex.HEADCOUNT] *
                    this.reportingTensor[C1ReportingVariablesIndex.UNIT_PRICE];
        }

        // calculate the costs
        this.reportingTensor[C1ReportingVariablesIndex.PAYROLL] =
            this.reportingTensor[C1ReportingVariablesIndex.PAYROLL] +
            this.reportingTensor[C1ReportingVariablesIndex.HEADCOUNT] *
                this.reportingTensor[C1ReportingVariablesIndex.UNIT_PAYROLL];

        // calculate the net income
        this.reportingTensor[C1ReportingVariablesIndex.NET_INCOME] =
            this.reportingTensor[C1ReportingVariablesIndex.REVENUE] -
            this.reportingTensor[C1ReportingVariablesIndex.PAYROLL];

        // clock tick
        this.reportingTensor[C1ReportingVariablesIndex.CLOCK_TICKS]++;

        this._log("C1 Reporting system transitioned", { reportingTensor: this.reportingTensor });
        return this.reportingTensor;
    }
}
