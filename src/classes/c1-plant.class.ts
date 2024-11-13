import { Plant, RandomStream, Logger } from "aethon-arion-pipeline";
import { C1OrgModelConfig } from "../interfaces/c1.model.interfaces";
import { C1PlantStateVariablesIndex } from "../constants/c1.model.constants";

export class C1Plant extends Plant {
    constructor(config: C1OrgModelConfig, random: RandomStream, logger: Logger) {
        logger.trace({ sourceObject: "Plant", message: "Initialising C1 Plant" });
        super(config.plant.initialState, logger);
        this._log("C1 Plant initialised", { stateTensor: this.stateTensor });
    }

    transitionState(inputTensor: number[][]): number[] {
        this._log("Transitioning C1 plant state", { stateTensor: this.stateTensor });
        let flag: number = 1;
        // logical AND all input signals; when everyone is working, the org works
        for (let alpha = 0; alpha < inputTensor.length; alpha++) {
            flag = flag * inputTensor[alpha][C1PlantStateVariablesIndex.ACTION];
        }
        this.delta = [flag - this.stateTensor[C1PlantStateVariablesIndex.ACTION]];
        this.stateTensor = [flag];
        this._log("C1 Plant state transitioned", { stateTensor: this.stateTensor });
        return this.stateTensor;
    }
}
