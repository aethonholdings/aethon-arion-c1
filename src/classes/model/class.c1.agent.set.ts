import { AgentSetTensors, Targets } from "aethon-arion-pipeline";
import { C1OrgModelConfig } from "../../interfaces/c1.model.interfaces";
import { AgentSet } from "aethon-arion-pipeline";
import { Logger } from "aethon-arion-pipeline";
import { RandomStream } from "aethon-arion-pipeline";
import { State } from "aethon-arion-pipeline";
import { StateAction, StateSelf } from "./class.c1.state";

export class C1AgentSet extends AgentSet {
    constructor(config: C1OrgModelConfig, randomStream: RandomStream, logger: Logger) {
        
        logger.trace({ sourceObject: "AgentSet", message: "Initialising C1 Agent Set" });
        // define the state set
        const states: State[] = [new StateAction(), new StateSelf()];

        // get the key model dimensions/ ranks
        const tensors: AgentSetTensors = {
            priorityTensor: config.agentSet.priorityTensor,
            influenceTensor: config.agentSet.influenceTensor,
            judgmentTensor: config.agentSet.judgmentTensor,
            incentiveTensor: config.agentSet.incentiveTensor
        } as AgentSetTensors;

        super(tensors, states, randomStream, logger, config.clockTickSeconds);
        this._log("C1 Agent Set initialised");
    }

    recalculateParams(targets: Targets, plantState: number[], reporting: number[]): C1AgentSet {
        this._log("Transitioning C1 Agent Set state");
        const calc = super.recalculateParams(targets, plantState, reporting);
        this._log("C1 Agent Set state transitioned");
        return calc;
    }
}
