import {
    GradientAscentOptimiserData,
    GradientAscentParameters,
    Logger,
    Model,
    Optimiser,
    Organisation,
    RandomStreamFactory,
    ResultDTO,
    SimulationConfig
} from "aethon-arion-pipeline";
import {
    C1GradientAscentParameterDTO,
    C1ModelIndex,
    C1ModelName,
    C1ReportingVariablesIndex
} from "../../constants/c1.model.constants";
import { C1Organisation } from "../core/c1-organisation.class";
import { C1PlanVsActualsReport } from "../analysis/c1-plan-vs-actuals.kpi-factory.class";
import { C1ConfiguratorParamData  } from "../../interfaces/c1.interfaces";
import { C1BaseConfigurator } from "./c1-base-configurator.class";
import { C1GradientAscentOptimiser } from "../optimisers/c1-gradient-ascent.optimiser.class";

export class C1Model extends Model<
    C1ConfiguratorParamData,
    GradientAscentParameters,
    GradientAscentOptimiserData<C1ConfiguratorParamData>
> {
    constructor() {
        // this casting is required in order to bypass a compiler error with type checking
        super(C1ModelName, C1ModelIndex);
        this._configurators.push(new C1BaseConfigurator(this));
        this._kpiFactories.push(new C1PlanVsActualsReport(this));
        const optimiser: Optimiser<
            C1ConfiguratorParamData,
            GradientAscentParameters,
            GradientAscentOptimiserData<C1ConfiguratorParamData>
        > = new C1GradientAscentOptimiser(this, C1GradientAscentParameterDTO);
        this._optimisers.push(optimiser);
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
