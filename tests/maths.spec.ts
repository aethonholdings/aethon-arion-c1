/**
 * Regression suite for mathematical properties established by analysis of the C1 dynamics. Deterministic (seeded
 * configurators and random streams); sized to run in seconds.
 */
import { Logger, RandomStreamFactory, StaticRandomStream } from "aethon-arion-pipeline";
import { C1, C1ConfiguratorNames } from "../src/constants/c1.model.constants";
import { c1DefaultConfiguratorParamData } from "../src/constants/c1.defaults.constants";

jest.setTimeout(120000);
const configurator = C1.getConfigurator(C1ConfiguratorNames.BASE);
const logger = new Logger();
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const sd = (x: number[]) => Math.sqrt(x.reduce((a, b) => a + (b - mean(x)) ** 2, 0) / (x.length - 1));
const median = (x: number[]) => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)];
const orgConfig = (data: any, seed: number) =>
    configurator.generate(
        { modelName: "C1", configuratorName: C1ConfiguratorNames.BASE, multipleOrgConfigs: true, data: { ...c1DefaultConfiguratorParamData(), graph: "teams", ...data } },
        seed
    );
const run = (oc: any, days: number, keys: number[]) => {
    const s = C1.createSimulation({ id: 1, days, randomStreamType: "static", orgConfig: oc, runCount: 0 } as any, logger, RandomStreamFactory.seeded(...keys));
    let o: any;
    s.run$().subscribe((x) => (o = x.organisation));
    return o;
};
const fractionOfPlan = (o: any) => o.getReporting().getReportingTensor()[0] / o.getBoard().getPlan().reporting[0];
const influenceOnly = (influence: string, signs: string) => ({
    spans: 3,
    layers: 3,
    graph: "top-down",
    matrixInit: { influence, judgment: "null", incentive: "null" },
    influenceSigns: signs
});

describe("Influence coupling stability (linearised operator)", () => {
    it("default random influence keeps agreement between agents stable", () => {
        for (let seed = 1; seed <= 20; seed++) {
            expect(orgConfig({ spans: 3, layers: 2, matrixInit: { influence: "random", judgment: "random", incentive: "random" } }, seed).diagnostics!.stable).toBe(true);
            expect(orgConfig(influenceOnly("random", "attractive"), seed).diagnostics!.stable).toBe(true);
        }
    });

    it("uniformly signed random influence makes agreement unstable in most org configs", () => {
        const unstable = Array.from({ length: 20 }, (_, k) => orgConfig(influenceOnly("random", "uniform"), k + 1).diagnostics!.stable).filter((s) => !s).length;
        expect(unstable).toBeGreaterThanOrEqual(16);
    });
});

describe("Disagreement dynamics in the engine (influence only, 13 agents, 20 days)", () => {
    const dispersionRatio = (influence: string, signs: string, seed: number) => {
        const oc = orgConfig(influenceOnly(influence, signs), seed);
        const r = new StaticRandomStream(seed);
        oc.agentSet.priorityTensor = oc.agentSet.priorityTensor.map((a: any) => a.map(() => { const p = 0.85 + 0.1 * (r.next() - 0.5); return [p, 1 - p]; }));
        const start = sd(oc.agentSet.priorityTensor.map((a: any) => a[0][0]));
        const o = run(oc, 20, [seed, 1, 1]);
        return sd(o.getAgents().getTensors().priorityTensor.map((a: any) => a[0][0])) / start;
    };
    it("attractive influence narrows disagreement", () => {
        expect(median([1, 2, 3].map((s) => dispersionRatio("purposeful", "attractive", s)))).toBeLessThan(0.5);
        expect(median([1, 2, 3].map((s) => dispersionRatio("random", "attractive", s)))).toBeLessThan(1);
    });
    it("uniformly signed influence widens it", () => {
        expect(median([1, 2, 3].map((s) => dispersionRatio("random", "uniform", s)))).toBeGreaterThan(1);
    });
});

describe("No sensitive dependence on initial conditions", () => {
    it("a 1e-9 perturbation of a transition probability leaves no trace under identical streams", () => {
        for (const seed of [1, 2, 3]) {
            const oc = orgConfig({ spans: 3, layers: 2, matrixInit: { influence: "random", judgment: "random", incentive: "random" } }, seed);
            const perturbed = JSON.parse(JSON.stringify(oc));
            perturbed.agentSet.priorityTensor[0][0][0] += 1e-9;
            perturbed.agentSet.priorityTensor[0][0][1] -= 1e-9;
            const a = run(oc, 20, [seed, 1, 1]).getAgents().getTensors().priorityTensor.flat(2);
            const b = run(perturbed, 20, [seed, 1, 1]).getAgents().getTensors().priorityTensor.flat(2);
            expect(a.reduce((acc: number, v: number, i: number) => acc + Math.abs(v - b[i]), 0)).toBeLessThan(1e-6);
        }
    });
});

describe("Common random numbers", () => {
    it("reduce the noise of a finite-difference gradient at least threefold", () => {
        const K = 5, R = 6, days = 5, g0 = 3e-5, dg = 6e-6;
        const point = (judgment: number, repeat: number, salt: number) =>
            mean(
                Array.from({ length: K }, (_, i) => {
                    const k = i + 1;
                    const oc = orgConfig({ spans: 3, layers: 2, matrixInit: { influence: "random", judgment: "random", incentive: "random" }, gains: { ...c1DefaultConfiguratorParamData().gains, judgment } }, repeat * 100 + k + salt);
                    return fractionOfPlan(run(oc, days, [repeat, k + salt, 1]));
                })
            );
        const slopes = (crn: boolean) => Array.from({ length: R }, (_, r) => (point(g0 + dg, r + 1, crn ? 0 : 5000) - point(g0, r + 1, 0)) / dg);
        expect(sd(slopes(true))).toBeLessThan(sd(slopes(false)) / 3);
    });
});

describe("Calibrated default gains", () => {
    it("every gain has a non-flat response at the default point (4 agents, 20 days, random initialisation)", () => {
        const K = 4, g = c1DefaultConfiguratorParamData().gains as any;
        const perf = (gains: any) =>
            mean(Array.from({ length: K }, (_, i) => fractionOfPlan(run(orgConfig({ spans: 3, layers: 2, matrixInit: { influence: "random", judgment: "random", incentive: "random" }, gains }, 1000 + i + 1), 20, [7, i + 1, 1]))));
        const p0 = perf(g);
        expect(p0).toBeGreaterThan(0.1);
        expect(p0).toBeLessThan(0.9);
        for (const key of ["influence", "judgment", "incentive"]) {
            const elasticity = perf({ ...g, [key]: g[key] * Math.sqrt(10) }) - perf({ ...g, [key]: g[key] / Math.sqrt(10) });
            // calibrated defaults measure >= 0.27; the previous (uncalibrated) judgment default measured 0.06
            expect(Math.abs(elasticity)).toBeGreaterThan(0.15);
        }
    });
});
