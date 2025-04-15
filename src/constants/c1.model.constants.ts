import { DomainTypes, GradientAscentParameters, ModelIndexDTO } from "aethon-arion-pipeline";
import { C1Model } from "../classes/pipeline/c1-model.class";
import { C1ConfiguratorParamData } from "../interfaces/c1.interfaces";

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

export enum C1OptimiserNames {
    GRADIENT_ASCENT = "C1GradientAscentOptimiser"
}

export enum C1ConfiguratorNames {
    BASE = "C1BaseConfigurator"
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

// CONFIGURATORS --------------------------------
export const C1BaseConfiguratorDefaultData: C1ConfiguratorParamData = {
    spans: 1,
    layers: 1,
    gains: {
        influence: 0.00001,
        judgment: 0.00001,
        incentive: 0.00000001
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
    }
};

// The C1 model
export const C1: C1Model = new C1Model();
