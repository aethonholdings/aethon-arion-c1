import { C1ConfiguratorParamData } from "../interfaces/c1.interfaces";

// Default C1BaseConfigurator parameters. Kept free of model imports so that optimiser and configurator can use it
// without a circular import through the model constants. Treat as read-only: use c1DefaultConfiguratorParamData()
// to obtain a mutable copy.
export const C1BaseConfiguratorDefaultData: Readonly<C1ConfiguratorParamData> = {
    spans: 1,
    layers: 1,
    // calibrated so that the starting point responds to every gain within a 20 to 100 day horizon (largest smallest
    // elasticity across 4 and 13 agent teams with random initialisation): performance mid-range, not saturated, and
    // every gain on the steep part of its response curve rather than on a flat plateau (per second)
    gains: {
        influence: 0.00003,
        judgment: 0.00003,
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
    influenceNormalisation: "edge",
    influenceSigns: "attractive"
};

/** Returns a deep, mutable copy of the default C1BaseConfigurator parameters. */
export function c1DefaultConfiguratorParamData(): C1ConfiguratorParamData {
    return JSON.parse(JSON.stringify(C1BaseConfiguratorDefaultData));
}
