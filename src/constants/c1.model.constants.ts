import { DomainTypes, GradientAscentParameters, ModelIndexDTO } from "aethon-arion-pipeline";
import { C1Model } from "../classes/pipeline/c1-model.class";

// BASE CONSTANTS --------------------------------
export const C1ModelName: string = "C1";
export const C1ModelClockTickSeconds: number = 300;
export enum C1MatrixInitTypes {
    RANDOM = "random",
    PURPOSEFUL = "purposeful",
    HYBRID = "hybrid",
    NULL = "null"
}
export enum C1GraphTypes {
    TOP_DOWN = "top-down",
    TEAMS = "teams"
}

// AGENT SET -------------------------------------
export enum C1AgentStateIndex {
    ACTION = 0,
    SELF = 1
}

export enum C1AgentStates {
    ACTION = "Action",
    SELF = "Self"
}

export const C1AgentStatesArray: string[] = [C1AgentStates.ACTION, C1AgentStates.SELF];

// PLANT STATE VARIABLES -------------------------
export enum C1PlantStateVariablesIndex {
    ACTION = 0
}

export enum C1PlantStateVariables {
    ACTION = "Action"
}

export const C1PlantStateVariablesArray: string[] = [C1PlantStateVariables.ACTION];
export const C1PlantStateTarget: number[] = [1];
export const C1PlantStateIdle: number[] = [0];

// REPORTING ---------------------------------
export enum C1ReportingVariablesIndex {
    REVENUE = 0,
    PAYROLL = 1,
    NET_INCOME = 2,
    HEADCOUNT = 3,
    UNIT_PAYROLL = 4,
    UNIT_PRICE = 5,
    CLOCK_TICK_SECONDS = 6,
    CLOCK_TICKS = 7
}

export enum C1ReportingVariables {
    REVENUE = "Revenue",
    PAYROLL = "Payroll costs",
    NET_INCOME = "Net income",
    HEADCOUNT = "Headcount",
    UNIT_PAYROLL = "Unit payroll costs",
    UNIT_PRICE = "Sales price unit price",
    CLOCK_TICK_SECONDS = "Clock tick seconds",
    CLOCK_TICKS = "Clock ticks"
}

export const C1ReportingVariablesArray: string[] = [
    C1ReportingVariables.REVENUE,
    C1ReportingVariables.PAYROLL,
    C1ReportingVariables.NET_INCOME,
    C1ReportingVariables.HEADCOUNT,
    C1ReportingVariables.UNIT_PAYROLL,
    C1ReportingVariables.UNIT_PRICE,
    C1ReportingVariables.CLOCK_TICK_SECONDS,
    C1ReportingVariables.CLOCK_TICKS
];

export const C1ModelIndex: ModelIndexDTO = {
    reporting: {
        variableNames: C1ReportingVariablesArray,
        arrayIndex: {
            [C1ReportingVariables.REVENUE]: C1ReportingVariablesIndex.REVENUE,
            [C1ReportingVariables.PAYROLL]: C1ReportingVariablesIndex.PAYROLL,
            [C1ReportingVariables.NET_INCOME]: C1ReportingVariablesIndex.NET_INCOME,
            [C1ReportingVariables.HEADCOUNT]: C1ReportingVariablesIndex.HEADCOUNT,
            [C1ReportingVariables.UNIT_PAYROLL]: C1ReportingVariablesIndex.UNIT_PAYROLL,
            [C1ReportingVariables.UNIT_PRICE]: C1ReportingVariablesIndex.UNIT_PRICE,
            [C1ReportingVariables.CLOCK_TICK_SECONDS]: C1ReportingVariablesIndex.CLOCK_TICK_SECONDS,
            [C1ReportingVariables.CLOCK_TICKS]: C1ReportingVariablesIndex.CLOCK_TICKS
        }
    },
    plant: {
        variableNames: C1PlantStateVariablesArray,
        arrayIndex: {
            [C1PlantStateVariables.ACTION]: C1PlantStateVariablesIndex.ACTION
        }
    },
    agentSet: {
        states: {
            variableNames: C1AgentStatesArray,
            arrayIndex: {
                [C1AgentStates.ACTION]: C1AgentStateIndex.ACTION,
                [C1AgentStates.SELF]: C1AgentStateIndex.SELF
            }
        }
    },
    board: {
        variableNames: C1ReportingVariablesArray,
        arrayIndex: {
            [C1ReportingVariables.REVENUE]: C1ReportingVariablesIndex.REVENUE,
            [C1ReportingVariables.PAYROLL]: C1ReportingVariablesIndex.PAYROLL,
            [C1ReportingVariables.NET_INCOME]: C1ReportingVariablesIndex.NET_INCOME,
            [C1ReportingVariables.HEADCOUNT]: C1ReportingVariablesIndex.HEADCOUNT,
            [C1ReportingVariables.UNIT_PAYROLL]: C1ReportingVariablesIndex.UNIT_PAYROLL,
            [C1ReportingVariables.UNIT_PRICE]: C1ReportingVariablesIndex.UNIT_PRICE,
            [C1ReportingVariables.CLOCK_TICK_SECONDS]: C1ReportingVariablesIndex.CLOCK_TICK_SECONDS,
            [C1ReportingVariables.CLOCK_TICKS]: C1ReportingVariablesIndex.CLOCK_TICKS
        }
    }
};

// REPORTS  ---------------------------------
export enum KPIFactoryIndex {
    PLAN_VS_ACTUALS = "Plan vs Actuals"
}

// GRADIENT ASCENT  ---------------------------------
export const C1GradientAscentOptimiserName = "C1GradientAscentOptimiser";
export const C1GradientAscentParameterDTO: GradientAscentParameters = {
    iterations: {
        learningRate: 0.01,
        tolerance: 0.0001,
        max: 1000
    },
    parameterSpace: [
        { id: "spans", domain: { type: DomainTypes.DISCRETE, optimise: true, min: 1, max: 5, derivativeStepSize: 1 } },
        { id: "layers", domain: { type: DomainTypes.DISCRETE, optimise: true, min: 1, max: 3, derivativeStepSize: 1 } },
        {
            id: "gains.influence",
            domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 0, max: 0.1,derivativeStepSize: 0.01 }
            
        },
        {
            id: "gains.judgment",
            domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 0, max: 0.1,derivativeStepSize: 0.01 }
            
        },
        {
            id: "gains.incentive",
            domain: { type: DomainTypes.CONTINUOUS, optimise: true, min: 0, max: 0.0001,derivativeStepSize: 0.00001 },
            
        },
        {
            id: "actionStateProbability",
            domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 0.85 }
        },
        {
            id: "graph",
            domain: {
                type: DomainTypes.CATEGORICAL,
                optimise: false,
                default: C1GraphTypes.TOP_DOWN,
                categories: [C1GraphTypes.TOP_DOWN, C1GraphTypes.TEAMS]
            }
        },
        {
            id: "matrixInit.influence",
            domain: {
                type: DomainTypes.CATEGORICAL,
                optimise: true,
                categories: [
                    C1MatrixInitTypes.HYBRID,
                    C1MatrixInitTypes.PURPOSEFUL
                ]
            }
        },
        {
            id: "matrixInit.judgment",
            domain: {
                type: DomainTypes.CATEGORICAL,
                optimise: false,
                default: C1MatrixInitTypes.RANDOM,
                categories: [
                    C1MatrixInitTypes.NULL,
                    C1MatrixInitTypes.RANDOM,
                    C1MatrixInitTypes.HYBRID,
                    C1MatrixInitTypes.PURPOSEFUL
                ]
            }
        },
        {
            id: "matrixInit.incentive",
            domain: {
                type: DomainTypes.CATEGORICAL,
                optimise: false,
                default: C1MatrixInitTypes.PURPOSEFUL,
                categories: [
                    C1MatrixInitTypes.NULL,
                    C1MatrixInitTypes.RANDOM,
                    C1MatrixInitTypes.PURPOSEFUL,
                    C1MatrixInitTypes.HYBRID
                ]
            }
        },
        {
            id: "board.controlStep",
            domain: { type: DomainTypes.BOOLEAN, optimise: false, default: false }
        },
        {
            id: "reporting.unitPayroll",
            domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 1 }
        },
        {
            id: "reporting.unitPrice",
            domain: { type: DomainTypes.CONTINUOUS, optimise: false, default: 1 }
        }
    ]
};

// The C1 model
export const C1: C1Model = new C1Model();
