import { Result } from "aethon-arion-pipeline";
import {
    C1PlantStateVariables,
    C1ReportingVariables,
    C1ReportingVariablesIndex
} from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData } from "../../interfaces/c1.interfaces";

export class C1Result extends Result<C1ConfiguratorParamData> {
    reportingVariableEnum = C1ReportingVariables;
    plantStateVariableEnum = C1PlantStateVariables;
    stateCount: number = 0;

    getPerformance(): number {
        const headcount = this.reporting[C1ReportingVariablesIndex.HEADCOUNT];
        const revenue = this.reporting[C1ReportingVariablesIndex.REVENUE];
        return revenue / headcount;
    }
}
