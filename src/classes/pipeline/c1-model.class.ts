import { Logger, Model, Organisation, RandomStreamFactory, ResultDTO, SimulationConfig } from "aethon-arion-pipeline";
import { C1ModelIndex, C1ModelName, C1ReportingVariablesIndex } from "../../constants/c1.model.constants";
import { C1Organisation } from "../core/c1-organisation.class";
import { C1BaseConfigurator } from "./c1-configurator.class";
import { C1PlanVsActualsReport } from "../analysis/c1-plan-vs-actuals.kpi-factory.class";

export class C1Model extends Model {
    constructor() {
        super(C1ModelName, C1ModelIndex);
        this._configurators.push(new C1BaseConfigurator(this));
        this._kpiFactories.push(new C1PlanVsActualsReport(this));
    }

    getPerformance(resultDTO: ResultDTO): number | undefined {
        const reportingTensor = resultDTO.reporting;
        const headcount = reportingTensor[C1ReportingVariablesIndex.HEADCOUNT];
        if (headcount === 0) return undefined;
        const revenue = reportingTensor[C1ReportingVariablesIndex.REVENUE];
        return revenue / headcount;
    }

    protected _instantiateModelOrgConfig(
        simConfig: SimulationConfig,
        randomStreamFactory: RandomStreamFactory,
        logger: Logger
    ): Organisation {
        return new C1Organisation(simConfig, randomStreamFactory, logger);
    }
}
