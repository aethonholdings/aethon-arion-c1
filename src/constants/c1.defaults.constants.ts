import { C1ConfiguratorParamData } from "../interfaces/c1.interfaces";

// Default C1BaseConfigurator parameters. Kept free of model imports so that optimiser and configurator can use it
// without a circular import through the model constants. Treat as read-only: use c1DefaultConfiguratorParamData()
// to obtain a mutable copy.
export const C1BaseConfiguratorDefaultData: Readonly<C1ConfiguratorParamData> = {
    spans: 1,
    layers: 1,
    gains: {
        influence: 0.00001,
        judgment: 0.00001,
        // per second, applied to the relative incentive gap (fraction of target); comparable to the judgment gain
        incentive: 0.00001
    },
    actionStateProbability: 0.85,
    graph: "teams",
    matrixInit: {
        influence: "random",
        judgment: "random",
        incentive: "random"
    },
    reporting: {
        unitPayroll: 1,
        unitPrice: 1
    },
    board: {
        controlStep: false
    },
    hybridNoise: 0.5,
    // 3 working days: reachable within the influence stability limit for hierarchies up to about 31 agents
    influenceConsensusHours: 24
};

/** Returns a deep, mutable copy of the default C1BaseConfigurator parameters. */
export function c1DefaultConfiguratorParamData(): C1ConfiguratorParamData {
    return JSON.parse(JSON.stringify(C1BaseConfiguratorDefaultData));
}
