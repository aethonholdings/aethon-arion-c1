import { C1ConfiguratorNames, C1MatrixInitTypes, C1OptimiserNames } from "../../constants/c1.model.constants";
import { c1DefaultConfiguratorParamData } from "../../constants/c1.defaults.constants";
import { C1ConfiguratorParamData } from "../../interfaces/c1.interfaces";
import { ConfiguratorParamsDTO, ConvergenceTestDTO, DataPoint, Optimiser, OptimiserStateDTO, SimSetDTO, States } from "aethon-arion-pipeline";
import { C1Model } from "../pipeline/c1-model.class";
import { pairedDifference } from "./c1-gradient-ascent.optimiser.class";
const flatten = require("flat");

/** Parameters of a control experiment: one configuration, run with and without the board's control step. */
export interface C1ControlExperimentParameters {
    /** The configurator settings to test (e.g. taken from an org config); missing fields use the C1 defaults. */
    config: Partial<C1ConfiguratorParamData>;
    /** Org configs (replicates) per group; replicate k of both groups is the same organisation. */
    orgConfigs: number;
}

export type C1ControlExperimentOutput = { performance?: number; orgConfigCount?: number };

/** Paired difference test − control over the common replicates. */
export interface C1ControlExperimentResult {
    control: number;
    test: number;
    delta: number;
    standardError: number;
    ci95: [number, number];
    relativeDelta: number | null;
    pairs: number;
    testBetter: number;
    controlBetter: number;
    ties: number;
    /** The interval excludes 0: the step changes performance beyond run-to-run and organisation-to-organisation noise. */
    significant: boolean;
}

export interface C1ControlExperimentData {
    dataPoints: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, C1ControlExperimentOutput>[];
    result?: C1ControlExperimentResult;
}

export const C1_CONTROL_EXPERIMENT_MAX_ORG_CONFIGS = 2000;

/**
 * Control experiment: runs one configuration twice, as a control group (no control step) and a test group (the
 * board switches its plan at the halfway point, `board.controlStep: true`), and reports the paired
 * difference in performance. No optimisation: a single optimiser state, which completes as converged.
 *
 * @remarks
 * Both groups draw org config replicate k from the same seed, and the board consumes no random numbers, so replicate
 * k of the two groups is the same organisation; run j of it also shares its random streams. The difference is
 * therefore paired by replicate and reflects the control step alone.
 */
export class C1ControlExperimentOptimiser extends Optimiser<
    C1ConfiguratorParamData,
    C1ControlExperimentParameters,
    C1ControlExperimentData
> {
    private _configuratorName: string = C1ConfiguratorNames.BASE;

    constructor(model: C1Model) {
        super(C1OptimiserNames.CONTROL_EXPERIMENT, model);
    }

    validateParameters(parameters: C1ControlExperimentParameters): string[] {
        const errors: string[] = [];
        if (!parameters || typeof parameters !== "object") return ["parameters must be an object"];
        if (!parameters.config || typeof parameters.config !== "object") errors.push("config must be an object");
        const n = parameters.orgConfigs;
        if (!Number.isInteger(n) || n < 2 || n > C1_CONTROL_EXPERIMENT_MAX_ORG_CONFIGS) {
            errors.push(`orgConfigs must be an integer from 2 to ${C1_CONTROL_EXPERIMENT_MAX_ORG_CONFIGS}`);
        }
        return errors;
    }

    /** Each group runs at least this many org configs. */
    requiredOrgConfigs(parameters: C1ControlExperimentParameters): number | undefined {
        return parameters?.orgConfigs;
    }

    initialise(parameters: C1ControlExperimentParameters, simSetDTO?: SimSetDTO): OptimiserStateDTO<C1ControlExperimentData> {
        const errors = this.validateParameters(parameters);
        if (errors.length > 0) throw new Error(`Invalid optimiser parameters: ${errors.join("; ")}`);
        const config: C1ConfiguratorParamData = flatten.unflatten({
            ...flatten(c1DefaultConfiguratorParamData()),
            ...flatten(JSON.parse(JSON.stringify(parameters.config)))
        });
        const arm = (controlStep: boolean): C1ConfiguratorParamData =>
            JSON.parse(JSON.stringify({ ...config, board: { ...(config.board ?? {}), controlStep } }));
        return {
            modelName: this.model.name,
            optimiserName: this.name,
            converged: false,
            start: new Date(),
            percentComplete: 0,
            status: States.PENDING,
            stepCount: 0,
            simSet: simSetDTO as SimSetDTO,
            optimiserData: { dataPoints: [this._dataPoint("control", arm(false)), this._dataPoint("test", arm(true))] }
        };
    }

    update(
        parameters: C1ControlExperimentParameters,
        state: OptimiserStateDTO<C1ControlExperimentData>,
        results: ConvergenceTestDTO[]
    ): OptimiserStateDTO<C1ControlExperimentData> {
        if (!state || !results) throw new Error("Invalid parameters for update; provide both state and results");
        const resultOf = (point: DataPoint<any, any>) => {
            const result = results.find((r) => r.configuratorParams.hash === point.data.inputs.hash);
            if (!result) throw new Error(`Result not found for ${point.id} in optimiser state ${state.id}`);
            return result;
        };
        const [control, test] = this._points(state);
        for (const point of [control, test]) {
            const result = resultOf(point);
            point.status = result.state;
            point.data.outputs = { performance: result.avgPerformance ?? undefined, orgConfigCount: result.orgConfigCount };
        }
        const statuses = [control.status, test.status];
        if (statuses.includes(States.FAILED)) {
            state.status = States.FAILED;
            throw new Error("Control experiment failed; a group's simulations failed");
        }
        if (statuses.every((s) => s === States.COMPLETED)) {
            state.optimiserData.result = C1ControlExperimentOptimiser.compare(resultOf(control), resultOf(test));
            state.performance = state.optimiserData.result.delta;
            state.status = States.COMPLETED;
            state.percentComplete = 100;
            state.converged = true; // nothing to optimise: the SimSet completes with this state
            state.end = new Date();
            state.durationSec = state.start ? (state.end.getTime() - new Date(state.start).getTime()) / 1000 : undefined;
        } else if (statuses.includes(States.RUNNING) || statuses.includes(States.COMPLETED)) {
            state.status = States.RUNNING;
        }
        return state;
    }

    /** A control experiment has a single state; there is never a next step. */
    step(): OptimiserStateDTO<C1ControlExperimentData> {
        throw new Error("A control experiment has no further steps");
    }

    getStateRequiredConfiguratorParams(state: OptimiserStateDTO<C1ControlExperimentData>): ConfiguratorParamsDTO<C1ConfiguratorParamData>[] {
        return state.optimiserData.dataPoints.map((point) => point.data.inputs);
    }

    /** Paired comparison of the test group against the control group. */
    static compare(control: ConvergenceTestDTO, test: ConvergenceTestDTO): C1ControlExperimentResult {
        const difference = pairedDifference(control, test);
        const replicates = (result: ConvergenceTestDTO) =>
            new Map<number, number>(
                ((result as any).replicates ?? [])
                    .filter((r: any) => r.replicate !== null && r.avgPerformance !== null)
                    .map((r: any) => [r.replicate as number, r.avgPerformance as number])
            );
        const c = replicates(control), t = replicates(test);
        let testBetter = 0, controlBetter = 0, ties = 0;
        for (const [k, value] of c) {
            if (!t.has(k)) continue;
            const d = (t.get(k) as number) - value;
            if (d > 0) testBetter++;
            else if (d < 0) controlBetter++;
            else ties++;
        }
        const controlMean = control.avgPerformance ?? 0;
        const half = 1.96 * difference.standardError;
        return {
            control: controlMean,
            test: test.avgPerformance ?? 0,
            delta: difference.mean,
            standardError: difference.standardError,
            ci95: [difference.mean - half, difference.mean + half],
            relativeDelta: controlMean !== 0 ? difference.mean / Math.abs(controlMean) : null,
            pairs: difference.pairs,
            testBetter,
            controlBetter,
            ties,
            significant: difference.mean - half > 0 || difference.mean + half < 0
        };
    }

    private _points(state: OptimiserStateDTO<C1ControlExperimentData>) {
        const find = (id: string) => {
            const point = state.optimiserData.dataPoints.find((p) => p.id === id);
            if (!point) throw new Error(`Control experiment state has no ${id} group`);
            return point;
        };
        return [find("control"), find("test")];
    }

    private _dataPoint(id: string, config: C1ConfiguratorParamData): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, C1ControlExperimentOutput> {
        const random = [C1MatrixInitTypes.RANDOM, C1MatrixInitTypes.HYBRID] as string[];
        return {
            id,
            data: {
                inputs: {
                    modelName: this.model.name,
                    modelVersion: this.model.version,
                    configuratorName: this._configuratorName,
                    multipleOrgConfigs: Object.values(config.matrixInit ?? {}).some((init) => random.includes(init as string)),
                    data: config,
                    hash: this.model.hashConfiguratorParams(this._configuratorName, config)
                } as ConfiguratorParamsDTO<C1ConfiguratorParamData>,
                outputs: {}
            },
            status: States.PENDING
        };
    }
}
