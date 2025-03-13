import {
    GradientAscentDTO,
    Logger,
    Model,
    Optimiser,
    Organisation,
    RandomStreamFactory,
    ResultDTO,
    SimulationConfig
} from "aethon-arion-pipeline";
import { C1ModelIndex, C1ModelName, C1ReportingVariablesIndex } from "../../constants/c1.model.constants";
import { C1Organisation } from "../core/c1-organisation.class";
import { C1PlanVsActualsReport } from "../analysis/c1-plan-vs-actuals.kpi-factory.class";
import { C1ConfiguratorParamData } from "../../interfaces/c1.interfaces";
import { C1BaseConfigurator } from "./c1-base-configurator.class";
import { GradientAscentOptimiser } from "./c1-gradient-ascent.optimiser.class";

export class C1Model extends Model<C1ConfiguratorParamData, GradientAscentDTO> {
    constructor() {
        // this casting is required in order to bypass a compiler error with type checking
        const optimiser = new GradientAscentOptimiser() as unknown as Optimiser<
            C1ConfiguratorParamData,
            GradientAscentDTO
        >;
        super(C1ModelName, C1ModelIndex, optimiser);
        this._configurators.push(new C1BaseConfigurator(this));
        this._kpiFactories.push(new C1PlanVsActualsReport(this));
    }

    getPerformance(resultDTO: ResultDTO): number | undefined {
        return resultDTO.reporting[C1ReportingVariablesIndex.REVENUE];
    }

    protected _instantiateModelOrgConfig(
        simConfig: SimulationConfig,
        randomStreamFactory: RandomStreamFactory,
        logger: Logger
    ): Organisation {
        return new C1Organisation(simConfig, randomStreamFactory, logger);
    }
}
