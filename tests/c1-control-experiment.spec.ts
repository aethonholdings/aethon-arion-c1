import { States } from "aethon-arion-pipeline";
import { C1, C1ConfiguratorNames, C1OptimiserNames } from "../src/constants/c1.model.constants";
import { C1ControlExperimentOptimiser } from "../src/classes/optimisers/c1-control-experiment.optimiser.class";

const optimiser = C1.getOptimiser(C1OptimiserNames.CONTROL_EXPERIMENT) as unknown as C1ControlExperimentOptimiser;
const params = (overrides: any = {}) => ({
    config: { spans: 3, layers: 2, matrixInit: { influence: "random", judgment: "random", incentive: "purposeful" } },
    orgConfigs: 50,
    ...overrides
});
// a convergence test result with per-replicate means, as the server attaches them
const result = (hash: string | undefined, replicates: number[], state: string = States.COMPLETED): any => ({
    configuratorParams: { hash },
    state,
    orgConfigCount: replicates.length,
    avgPerformance: replicates.reduce((a, b) => a + b, 0) / replicates.length,
    replicates: replicates.map((avgPerformance, i) => ({ replicate: i + 1, avgPerformance }))
});

describe("C1 control experiment", () => {
    it("is registered with the model, after the default optimiser", () => {
        expect(optimiser).toBeInstanceOf(C1ControlExperimentOptimiser);
        expect(C1.getDefaultOptimiser().name).toBe(C1OptimiserNames.GRADIENT_ASCENT);
    });

    it("validates its parameters", () => {
        expect(optimiser.validateParameters(params())).toEqual([]);
        expect((optimiser.validateParameters(params({ orgConfigs: 1 }))).length).toBe(1);
        expect((optimiser.validateParameters(params({ orgConfigs: 2.5 }))).length).toBe(1);
        expect((optimiser.validateParameters(params({ config: undefined }))).length).toBe(1);
        expect(optimiser.requiredOrgConfigs(params())).toBe(50);
    });

    it("creates a control and a test group that differ only in the control step", () => {
        const state = optimiser.initialise(params());
        const [control, test] = state.optimiserData.dataPoints;
        expect([control.id, test.id]).toEqual(["control", "test"]);
        expect(control.data.inputs.data.board.controlStep).toBe(false);
        expect(test.data.inputs.data.board.controlStep).toBe(true);
        const { board: b1, ...rest1 } = control.data.inputs.data as any;
        const { board: b2, ...rest2 } = test.data.inputs.data as any;
        expect(rest1).toEqual(rest2);
        expect(control.data.inputs.hash).not.toBe(test.data.inputs.hash);
        expect(control.data.inputs.multipleOrgConfigs).toBe(true);
        expect(control.data.inputs.data.gains).toBeDefined(); // missing settings take the C1 defaults
        expect((optimiser.getStateRequiredConfiguratorParams(state)).length).toBe(2);
        // a test group is a control group with the step: a control step requested in the config is overridden
        const forced = optimiser.initialise(params({ config: { ...params().config, board: { controlStep: true } } }));
        expect(forced.optimiserData.dataPoints[0].data.inputs.data.board.controlStep).toBe(false);
    });

    it("builds the same organisation for replicate k of both groups", () => {
        const state = optimiser.initialise(params());
        const configurator = C1.getConfigurator(C1ConfiguratorNames.BASE);
        const [control, test] = state.optimiserData.dataPoints.map((p) => configurator.generate(p.data.inputs, 12345));
        expect(test.agentSet).toEqual(control.agentSet);
        expect(test.plant).toEqual(control.plant);
        expect((control.board as any).controlStep).toBe(false);
        expect((test.board as any).controlStep).toBe(true);
    });

    it("reports the paired difference test − control and completes as converged", () => {
        const state = optimiser.initialise(params({ orgConfigs: 5 }));
        const [control, test] = state.optimiserData.dataPoints;
        // replicate means differ a lot between organisations; the step costs about 10 in every one of them
        const c = [100, 200, 300, 400, 500];
        const t = [91, 189, 292, 389, 489];
        const updated = optimiser.update(params(), state, [result(control.data.inputs.hash, c), result(test.data.inputs.hash, t)]);
        const r = updated.optimiserData.result!;
        expect(updated.status).toBe(States.COMPLETED);
        expect(updated.converged).toBe(true);
        expect(r.delta).toBeCloseTo(-10, 6);
        expect(r.pairs).toBe(5);
        expect(r.standardError).toBeLessThan(1); // pairing removes the organisation-to-organisation spread
        expect(r.ci95[1]).toBeLessThan(0);
        expect(r.significant).toBe(true);
        expect([r.testBetter, r.controlBetter, r.ties]).toEqual([0, 5, 0]);
        expect(r.relativeDelta).toBeCloseTo(-10 / 300, 6);
        expect(updated.performance).toBeCloseTo(-10, 6);
    });

    it("is not significant when the pairs disagree, waits for both groups, and fails with a failed group", () => {
        const state = optimiser.initialise(params({ orgConfigs: 4 }));
        const [control, test] = state.optimiserData.dataPoints;
        const mixed = optimiser.update(params(), JSON.parse(JSON.stringify(state)), [
            result(control.data.inputs.hash, [10, 20, 30, 40]),
            result(test.data.inputs.hash, [12, 18, 33, 37])
        ]);
        expect(mixed.optimiserData.result!.significant).toBe(false);
        const waiting = optimiser.update(params(), JSON.parse(JSON.stringify(state)), [
            result(control.data.inputs.hash, [10, 20], States.COMPLETED),
            result(test.data.inputs.hash, [10, 20], States.RUNNING)
        ]);
        expect(waiting.status).toBe(States.RUNNING);
        expect(waiting.optimiserData.result).toBeUndefined();
        expect(() =>
            optimiser.update(params(), JSON.parse(JSON.stringify(state)), [
                result(control.data.inputs.hash, [10], States.FAILED),
                result(test.data.inputs.hash, [10])
            ])
        ).toThrow(/failed/);
        expect(() => optimiser.step()).toThrow(/no further steps/);
    });
});
