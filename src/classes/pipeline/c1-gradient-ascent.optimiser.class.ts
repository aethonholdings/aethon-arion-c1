import { ConfiguratorParamData } from "aethon-arion-pipeline/src/types/pipeline.types";
import { Optimiser } from "aethon-arion-pipeline/src/classes/pipeline/optimiser.class";
import { C1GradientAscentOptimiserName } from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData, GradientAscentDTO } from "../../interfaces/c1.interfaces";

export class GradientAscentOptimiser extends Optimiser<C1ConfiguratorParamData, GradientAscentDTO> {
    constructor() {
        // learningRate: 0.01, maxIterations: 1000, tolerance: 0.0001
        super(C1GradientAscentOptimiserName);
    }

    next(configuratorParamData: ConfiguratorParamData): GradientAscentDTO {
        
        return {} as GradientAscentDTO;
    }

    testConvergence(optimiserData: GradientAscentDTO[]): boolean {
        return false;
    }
}
